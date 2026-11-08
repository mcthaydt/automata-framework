import {
  type CompileOptions,
  compileContentFiles,
  contentModuleText,
  formatDiagnostic,
  VIRTUAL_MODULE_ID,
} from '@mcthaydt/automata-content/compile'
import type { ProjectStore } from '@mcthaydt/automata-editor/kit/storage'
import { transform } from 'sucrase'
import { type ConfigModules, defaultConfigModules, loadContentConfig } from './content-config.ts'
import { assemblePage, entriesOf } from './game-page.ts'
import { dirOf, extensionOf, normalizePath, outputPath, packageName, relativePath } from './game-paths.ts'
import { FRAMEWORK_ENTRY, type RuntimeManifest } from './runtime-manifest.ts'
import {
  applyEdits,
  buildConstantEdits,
  type Edit,
  findGlobs,
  functionBody,
  globToRegExp,
  pluginsOf,
  scanSpecifiers,
} from './vite-subset.ts'

// Compiles a game inside the app, on a phone, with no computer, no Node and no Vite: its own TypeScript is stripped of
// types one file at a time, the packages it imports are the ones the app carries (named in an import map), and the
// few things Vite did for it (stylesheets, pictures by `import.meta.glob`, `virtual:automata/content`, the build
// constants) are done as text edits. A game that needs more than that is not run; the app says why and says to play
// it on a computer.

/** Where the compiled game's files are served from: the folder the play scheme reads. */
export interface CompiledGame {
  /** Every file of the played game, by its path below the play folder. */
  readonly files: ReadonlyMap<string, string | Uint8Array>
  readonly entry: 'index.html'
}

export interface PlayRefusal {
  readonly reason:
    | 'package'
    | 'newer'
    | 'svelte'
    | 'plugin'
    | 'paraglide'
    | 'content'
    | 'unsupported'
    | 'missing'
  /** What to show the player, in words a person who has never seen code can follow. */
  readonly message: string
  /** The game's file the message is about. */
  readonly file?: string
}

export interface CompileDeps {
  /** The content entries a `content.config.ts` may import; the app's own by default. */
  readonly configModules?: ConfigModules
}

/** The module the compiled content is written to, which `virtual:automata/content` becomes. */
const CONTENT_MODULE = '__automata__/content.js'
const CODE = new Set(['.ts', '.tsx', '.mts', '.js', '.mjs'])
const TYPED = new Set(['.ts', '.tsx', '.mts'])
const HIDDEN = /^(?:\.git|\.automata|node_modules)\//
const decoder = new TextDecoder()

const refusal = (reason: PlayRefusal['reason'], message: string, file?: string): PlayRefusal =>
  file === undefined ? { reason, message } : { reason, message, file }
const cannotRun = (what: string): string => `${what}, which the phone app can't run.`
const onComputer = (what: string): string => `${cannotRun(what)} Play it on a computer.`

class Refused extends Error {
  readonly refusal: PlayRefusal
  constructor(value: PlayRefusal) {
    super(value.message)
    this.refusal = value
  }
}

const versionOf = (spec: string): readonly number[] | undefined => {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(spec)
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Whether `needed` is a later version than `carried`. */
function isNewer(needed: readonly number[], carried: readonly number[]): boolean {
  for (let i = 0; i < 3; i++) {
    if ((needed[i] ?? 0) !== (carried[i] ?? 0)) return (needed[i] ?? 0) > (carried[i] ?? 0)
  }
  return false
}

/** What a game's `package.json` says that the compile needs. */
interface Manifest {
  readonly frameworkSpec: string | undefined
  readonly imports: Readonly<Record<string, string>>
}

function readManifest(text: string | undefined): Manifest {
  try {
    const json = JSON.parse(text ?? '{}') as {
      dependencies?: Record<string, string>
      imports?: Record<string, string>
    }
    return { frameworkSpec: json.dependencies?.[FRAMEWORK_ENTRY], imports: json.imports ?? {} }
  } catch {
    return { frameworkSpec: undefined, imports: {} }
  }
}

/** A `#name/*` import of the package, as the file it means. */
function packageImport(imports: Manifest['imports'], specifier: string): string | undefined {
  for (const [key, target] of Object.entries(imports)) {
    if (key.endsWith('/*') && specifier.startsWith(key.slice(0, -1)) && target.endsWith('/*'))
      return normalizePath(target.slice(0, -1) + specifier.slice(key.length - 1))
    if (key === specifier) return normalizePath(target)
  }
  return undefined
}

/** Compiles the game in `store` to a page the play scheme serves, or says why the app can't. */
export async function compileGame(
  store: ProjectStore,
  runtime: RuntimeManifest,
  deps: CompileDeps = {},
): Promise<CompiledGame | PlayRefusal> {
  try {
    return await compile(store, runtime, deps)
  } catch (error) {
    if (error instanceof Refused) return error.refusal
    throw error
  }
}

async function compile(
  store: ProjectStore,
  runtime: RuntimeManifest,
  deps: CompileDeps,
): Promise<CompiledGame> {
  const paths = new Set((await store.list('')).map((entry) => entry.path).filter((p) => !HIDDEN.test(p)))
  const readBytes = async (path: string): Promise<Uint8Array> => {
    const data = await store.read(path)
    if (data === undefined) throw new Refused(refusal('missing', `${path} is not in the game.`, path))
    return data
  }
  const readText = async (path: string): Promise<string> => decoder.decode(await readBytes(path))
  const optionalText = async (path: string): Promise<string | undefined> =>
    paths.has(path) ? readText(path) : undefined

  if (!paths.has('index.html'))
    throw new Refused(refusal('missing', "This game has no index.html, so there's nothing to open."))

  const manifest = readManifest(await optionalText('package.json'))
  checkVersion(manifest, runtime)
  const viteConfig = ['vite.config.ts', 'vite.config.js', 'vite.config.mts'].find((path) => paths.has(path))
  if (viteConfig !== undefined) checkPlugins(viteConfig, await readText(viteConfig))
  const configPath = ['src/content.config.ts', 'content.config.ts'].find((path) => paths.has(path))
  const configText = configPath === undefined ? undefined : await readText(configPath)
  if (configPath !== undefined && /paraglide/i.test(configText ?? ''))
    throw new Refused(
      refusal(
        'paraglide',
        `${configPath} asks for translations, which the phone app can't build yet. Play it on a computer.`,
        configPath,
      ),
    )

  const page = await readText('index.html')
  const entries = entriesOf(page)
  const out = new Map<string, string | Uint8Array>()
  const styles: string[] = []
  const done = new Set<string>()
  const queue: string[] = []
  let needsContent = false

  const enqueue = (path: string): void => {
    if (!done.has(path)) {
      done.add(path)
      queue.push(path)
    }
  }

  for (const entry of entries.scripts) {
    const path = normalizePath(entry.src)
    if (path === undefined || !paths.has(path))
      throw new Refused(
        refusal('missing', `index.html opens ${entry.src}, which isn't in the game.`, 'index.html'),
      )
    enqueue(path)
  }
  for (const href of entries.localStyles) {
    const path = normalizePath(href)
    if (path !== undefined && paths.has(path)) out.set(path, await readText(path))
  }

  /** The text a module is rewritten to, and the files it brought with it. */
  async function rewrite(path: string): Promise<void> {
    const source = await readText(path)
    const dir = dirOf(outputPath(path))
    const edits: Edit[] = []

    /** `target`, an output path, as the module writes it. */
    const from = (target: string): string => relativePath(dir, target)

    const resolveLocal = (specifier: string): string | undefined => {
      const base = specifier.startsWith('#')
        ? packageImport(manifest.imports, specifier)
        : normalizePath(specifier.startsWith('/') ? specifier : `${dirOf(path)}/${specifier}`)
      if (base === undefined) return undefined
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.js`,
        `${base}.tsx`,
        `${base}/index.ts`,
        `${base}/index.js`,
        base.replace(/\.js$/, '.ts'),
      ]
      return candidates.find((each) => paths.has(each))
    }

    for (const found of scanSpecifiers(source)) {
      const specifier = found.value
      const isLocal = /^(?:\.{1,2}\/|\/|#)/.test(specifier)

      if (isLocal) {
        const target = resolveLocal(specifier)
        if (target === undefined)
          throw new Refused(
            refusal('missing', `${path} imports ${specifier}, which isn't in the game.`, path),
          )
        const extension = extensionOf(target)
        if (extension === '.svelte')
          throw new Refused(
            refusal(
              'svelte',
              `${target} is a Svelte file, which the phone app can't run yet. Play it on a computer.`,
              target,
            ),
          )
        if (extension === '.css') {
          if (found.kind !== 'side-effect')
            throw new Refused(
              refusal('unsupported', `${path} uses ${target} in a way the phone app can't run yet.`, path),
            )
          out.set(target, await readText(target))
          styles.push(`./${target}`)
          edits.push({ start: found.statementStart, end: found.statementEnd, text: '' })
        } else if (CODE.has(extension)) {
          enqueue(target)
          edits.push({ start: found.start, end: found.end, text: from(outputPath(target)) })
        } else {
          // A picture, a sound, JSON: a module that default-exports where the file is, or its text.
          const module = `${target}.js`
          if (extension === '.json') out.set(module, `export default ${await readText(target)}\n`)
          else {
            out.set(target, await readBytes(target))
            out.set(
              module,
              `export default new URL(${JSON.stringify(`./${target.slice(target.lastIndexOf('/') + 1)}`)}, import.meta.url).href\n`,
            )
          }
          edits.push({ start: found.start, end: found.end, text: from(module) })
        }
        continue
      }

      if (specifier === VIRTUAL_MODULE_ID) {
        needsContent = true
        edits.push({ start: found.start, end: found.end, text: from(CONTENT_MODULE) })
      } else if (specifier in runtime.packages) {
        if (specifier.endsWith('.css')) {
          if (found.kind !== 'side-effect')
            throw new Refused(
              refusal('unsupported', `${path} uses ${specifier} in a way the phone app can't run yet.`, path),
            )
          styles.push((runtime.packages[specifier] as { url: string }).url)
          edits.push({ start: found.statementStart, end: found.statementEnd, text: '' })
        }
      } else
        throw new Refused(refusal('package', onComputer(`This game uses ${packageName(specifier)}`), path))
    }

    for (const glob of findGlobs(source)) {
      if (!glob.supported)
        throw new Refused(
          refusal(
            'unsupported',
            `${path} loads files in a way the phone app can't run yet. Play it on a computer.`,
            path,
          ),
        )
      const fromRoot = glob.pattern.startsWith('/')
      const pattern = fromRoot ? glob.pattern.slice(1) : normalizePath(`${dirOf(path)}/${glob.pattern}`)
      const matcher = globToRegExp(pattern ?? '')
      const found = [...paths].filter((each) => matcher.test(each)).sort()
      const members: string[] = []
      for (const asset of found) {
        out.set(asset, await readBytes(asset))
        const key = fromRoot ? `/${asset}` : relativePath(dirOf(path), asset)
        members.push(
          `${JSON.stringify(key)}: new URL(${JSON.stringify(relativePath(dir, asset))}, import.meta.url).href`,
        )
      }
      edits.push({ start: glob.start, end: glob.end, text: `{ ${members.join(', ')} }` })
    }

    edits.push(...buildConstantEdits(source))
    const rewritten = applyEdits(source, edits)
    const typed = TYPED.has(extensionOf(path))
    try {
      const code = typed
        ? transform(rewritten, { transforms: ['typescript'], disableESTransforms: true, filePath: path }).code
        : rewritten
      out.set(outputPath(path), code)
    } catch (error) {
      throw new Refused(refusal('content', `${path}: ${String((error as Error).message ?? error)}`, path))
    }
  }

  while (queue.length > 0) await rewrite(queue.shift() as string)

  if (needsContent) {
    if (configPath === undefined || configText === undefined)
      throw new Refused(
        refusal(
          'content',
          "This game has no content.config.ts, so the phone can't build its content. Open it on a computer once to add it.",
        ),
      )
    const loaded = loadContentConfig(configText, deps.configModules ?? defaultConfigModules())
    if (!loaded.ok) throw new Refused(refusal('content', `${configPath}: ${loaded.message}`, configPath))
    out.set(CONTENT_MODULE, contentModuleText(await compileContent(paths, readText, loaded.options)))
  }

  out.set('index.html', assemblePage(page, entries, runtime, styles, outputPath))
  return { files: new Map([...out].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), entry: 'index.html' }
}

/** The content of the game's `content/` folder, compiled, or the Problems panel's lines. */
async function compileContent(
  paths: ReadonlySet<string>,
  readText: (path: string) => Promise<string>,
  options: CompileOptions,
): Promise<Extract<ReturnType<typeof compileContentFiles>, { ok: true }>['content']> {
  const tree = new Map<string, string>()
  for (const path of paths) if (path.startsWith('content/')) tree.set(path, await readText(path))
  const result = compileContentFiles(tree, options)
  if (result.ok) return result.content
  const lines = [...result.diagnostics.map(formatDiagnostic), ...result.configProblems]
  throw new Refused(refusal('content', lines.join('\n')))
}

function checkVersion(manifest: Manifest, runtime: RuntimeManifest): void {
  const needed = manifest.frameworkSpec === undefined ? undefined : versionOf(manifest.frameworkSpec)
  const carried = versionOf(runtime.packages[FRAMEWORK_ENTRY]?.version ?? '')
  if (needed !== undefined && carried !== undefined && isNewer(needed, carried))
    throw new Refused(refusal('newer', 'This game needs a newer app. Update Automata to play it.'))
}

/** The plugins a Vite config may list: Svelte, the content plugin, and a function of the game's that returns it. */
function checkPlugins(file: string, config: string): void {
  for (const name of pluginsOf(config)) {
    if (name === 'svelte' || name === 'automataContent') continue
    if (functionBody(config, name)?.includes('automataContent(') === true) continue
    throw new Refused(refusal('plugin', onComputer(`${file} uses ${name}`), file))
  }
}
