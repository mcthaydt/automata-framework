// The Vite plugin: content compiles when Vite starts, and again on every save in dev.
// The dev half runs on Vite's own file watcher and HMR channel.
//
// It calls exactly the same build as `automata-content build`, so a save produces the bytes a commit
// would. Two properties matter more than speed:
//   - Builds are serialized on one promise chain, so two quick saves cannot write out of order and leave
//     the older content on disk.
//   - Content is published only after a build succeeded, so a bad save reports its diagnostics, keeps the
//     last good files and module, and leaves the watcher alive for the fix.

import { dirname, join, sep } from 'node:path'
import { Effect, Either } from 'effect'
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { type CompiledContent, type ContentOptions, outDirOf } from '../../shared/compile/compile-content'
import type {
  ContentCompileFailed,
  ContentWriteFailed,
  InvalidContentConfig,
} from '../../shared/compile/errors'
import { TRANSLATIONS_FOLDER } from '../../shared/compile/read-sources'
import { buildContent } from '../../shared/compile/write-outputs'
import { formatDiagnostic } from '../../shared/diagnostics/diagnostic'

/** The import path of the compiled content: `content`, `contentHash`, `simContent` and `simContentHash`. */
export const VIRTUAL_MODULE_ID = 'virtual:automata/content'
const RESOLVED_ID = `\0${VIRTUAL_MODULE_ID}`

/** Long enough to collapse an editor's write burst, short enough to feel live. */
const DEBOUNCE_MS = 50

/** The plugin's options: `ContentOptions`, with `root` defaulting to Vite's root. */
export type AutomataContentOptions = Omit<ContentOptions, 'root'> & { readonly root?: string | undefined }

type BuildOutcome =
  | { readonly ok: true; readonly content: CompiledContent }
  | { readonly ok: false; readonly lines: readonly string[] }

/** Runs one build and turns every way it can fail into lines an author can read. */
async function runBuild(options: ContentOptions): Promise<BuildOutcome> {
  let result: Either.Either<CompiledContent, ContentCompileFailed | InvalidContentConfig | ContentWriteFailed>
  try {
    result = await Effect.runPromise(Effect.either(buildContent(options)))
  } catch (error) {
    // A defect (a bug, not a typed failure). It is reported like any failed build, so the chain stays
    // usable and the next save is the retry.
    return {
      ok: false,
      lines: [`the content compiler crashed: ${error instanceof Error ? error.message : error}`],
    }
  }
  if (Either.isRight(result)) return { ok: true, content: result.right }
  const error = result.left
  switch (error._tag) {
    case 'ContentCompileFailed':
      return { ok: false, lines: error.diagnostics.map(formatDiagnostic) }
    case 'InvalidContentConfig':
      return { ok: false, lines: [`automata-content options: ${error.message}`] }
    case 'ContentWriteFailed':
      return { ok: false, lines: [`could not write ${error.path}: ${String(error.cause)}`] }
  }
}

/** Two outcomes a client cannot tell apart: the same content hash, or the same diagnostics. */
function sameOutcome(previous: BuildOutcome | undefined, next: BuildOutcome): boolean {
  if (previous === undefined || previous.ok !== next.ok) return false
  if (previous.ok && next.ok) return previous.content.hash === next.content.hash
  if (!previous.ok && !next.ok) return previous.lines.join('\n') === next.lines.join('\n')
  return false
}

// `simContent` is built from `content`'s own properties (`{ "room": content["room"], ... }`) rather than a
// second JSON literal, so the bundle holds the data once and the two share their objects.
const moduleCode = (content: CompiledContent): string => {
  const simFields = Object.keys(content.sim.data)
    .sort()
    .map((kind) => `${JSON.stringify(kind)}: content[${JSON.stringify(kind)}]`)
  return [
    `export const content = ${content.files.get('content.json') ?? '{}'}`,
    `export const contentHash = ${JSON.stringify(content.hash)}`,
    `export const simContent = { ${simFields.join(', ')} }`,
    `export const simContentHash = ${JSON.stringify(content.sim.hash)}`,
    '',
  ].join('\n')
}

/**
 * The Vite plugin that compiles content and serves it as `virtual:automata/content`. It builds when Vite
 * starts and on every save in dev, with the same build as `automata-content build`. A `vite build` with
 * content errors fails; a dev server keeps serving the last good content and reports the diagnostics through
 * Vite's logger and the `automata:content-error` event (`automata:content` after a good save). It also sets
 * `build.assetsInlineLimit: 0` when the game's config leaves it unset, so no asset becomes a `data:` URL that Ruken's
 * CSP refuses to fetch.
 */
export function automataContent(pluginOptions: AutomataContentOptions = { schemas: [] }): Plugin {
  let options: ContentOptions | undefined
  let command: ResolvedConfig['command'] = 'serve'
  let logError: (message: string) => void = () => {}
  let logWarning: (message: string) => void = () => {}

  let latest: CompiledContent | undefined
  let latestErrors: readonly string[] = []
  // Every build runs after the one before it; `load` waits on the chain so it never serves a half-done build.
  let chain: Promise<unknown> = Promise.resolve()
  let started = false
  let timer: ReturnType<typeof setTimeout> | undefined
  // The last build's outcome. `publish` sends an event only when it changes, so the several `change` events a
  // single save can fire (macOS) — or the watcher's startup noise — never send a second, identical event.
  let lastOutcome: BuildOutcome | undefined

  const enqueue = (): Promise<BuildOutcome> => {
    started = true
    const next = chain.then(async () => {
      const outcome = await runBuild(options as ContentOptions)
      if (outcome.ok) {
        for (const warning of outcome.content.warnings) logWarning(formatDiagnostic(warning))
        latest = outcome.content
        latestErrors = []
      } else latestErrors = outcome.lines
      return outcome
    })
    // The chain itself never rejects: one failed build must not stop every later one (audit of PR #8).
    chain = next.catch(() => undefined)
    return next
  }

  /** A changed path that should trigger a rebuild: authored TOML or a translation, never an output. */
  const isWatchedSource = (path: string): boolean => {
    if (options === undefined) return false
    const contentDir = join(options.root, 'content')
    const outDir = join(options.root, outDirOf(options))
    if (!path.startsWith(contentDir + sep) || path.startsWith(outDir + sep)) return false
    if (path.endsWith('.toml')) return true
    return path.endsWith('.json') && dirname(path) === join(contentDir, TRANSLATIONS_FOLDER)
  }

  const publish = (server: ViteDevServer, outcome: BuildOutcome): void => {
    if (!outcome.ok) {
      logError(outcome.lines.join('\n'))
      server.ws.send({
        type: 'custom',
        event: 'automata:content-error',
        data: { diagnostics: outcome.lines },
      })
      return
    }
    // Every environment (client, SSR) re-imports the module on its next request, and gets a real HMR update for
    // it: Vite walks up its importers to the module that accepts it (a game's main.ts restarts its game on the new
    // content, so the Tuner's game pane changes as you drag) or reloads the page when none does. A content file
    // is not a module, so Vite's own file watcher never sends this update. `reloadModule` needs HMR on; a server
    // with it off only invalidates.
    for (const environment of Object.values(server.environments)) {
      const module = environment.moduleGraph.getModuleById(RESOLVED_ID)
      if (module === undefined) continue
      environment.moduleGraph.invalidateModule(module)
      void environment.reloadModule(module)
    }
    server.ws.send({ type: 'custom', event: 'automata:content', data: { hash: outcome.content.hash } })
  }

  const settle = async (): Promise<void> => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    // Let a build already in flight finish, so nothing is written into a folder that is about to go away.
    await chain
  }

  return {
    name: 'automata-content',

    // Every asset ships as a file. Vite would inline one under 4 kB as a `data:` URL, which Pixi's loader fetches
    // and Ruken's CSP refuses (`connect-src` has no `data:`), so the asset would never load. A value the
    // game sets is kept: this hook's result is merged over the game's own config.
    //
    // It also defines `__AUTOMATA_DEBUG__`: true in the dev server and in a build made with `AUTOMATA_DEBUG=1`
    // (`automata build --debug`), false in a release build. A block a game guards with it is dropped from a release bundle, so a
    // dev-only overlay (Plus's `debug`) never ships. The game declares it: `declare const __AUTOMATA_DEBUG__: boolean`.
    config(userConfig, { command }) {
      const debug = command === 'serve' || process.env.AUTOMATA_DEBUG === '1'
      const define = { __AUTOMATA_DEBUG__: JSON.stringify(debug) }
      if (userConfig.build?.assetsInlineLimit !== undefined) return { define }
      return { define, build: { assetsInlineLimit: 0 } }
    },

    configResolved(config) {
      options = { ...pluginOptions, root: pluginOptions.root ?? config.root }
      command = config.command
      logError = (message) => config.logger.error(message)
      logWarning = (message) => config.logger.warn(message)
    },

    async buildStart() {
      const outcome = await enqueue()
      lastOutcome = outcome
      if (outcome.ok) return
      // A build must not ship stale content; a dev server keeps serving the last good content instead.
      if (command === 'build') this.error(`content has errors:\n${outcome.lines.join('\n')}`)
      logError(outcome.lines.join('\n'))
    },

    configureServer(server) {
      // Vite watches its own root. Content kept elsewhere (a game served from its checkout with its content in
      // another folder, as a journey's temp copy is) is added, so a save there still rebuilds; adding a folder
      // already inside the root changes nothing. `configResolved` has always run by now.
      if (options !== undefined) server.watcher.add(join(options.root, 'content'))
      server.watcher.on('all', (_event, path) => {
        if (!isWatchedSource(path)) return
        if (timer !== undefined) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = undefined
          void enqueue().then((outcome) => {
            if (sameOutcome(lastOutcome, outcome)) return
            lastOutcome = outcome
            publish(server, outcome)
          })
        }, DEBOUNCE_MS)
      })
    },

    resolveId(id) {
      // A query (`virtual:automata/content?v=<hash>`) is how a page imports the module again after a save; it
      // names the same module.
      return id.split('?')[0] === VIRTUAL_MODULE_ID ? RESOLVED_ID : undefined
    },

    async load(id) {
      if (id.split('?')[0] !== RESOLVED_ID) return undefined
      // A dev server may be asked for the module before `buildStart` ran.
      if (!started) lastOutcome = await enqueue()
      await chain
      if (latest === undefined) throw new Error(`content has errors:\n${latestErrors.join('\n')}`)
      return moduleCode(latest)
    },

    async buildEnd() {
      await settle()
    },
  }
}
