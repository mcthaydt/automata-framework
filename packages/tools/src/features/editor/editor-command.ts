// `automata editor`: serve an editor against a game checkout, on the loopback by default, or on the
// network with a token (`--lan`) so a tablet can open it. The server is `serve-editor.ts`; this is the command around it:
// which build to serve, what to print, and when to refuse. The dependencies are injected so the tests run no server.
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_IS_GONE, parseEditorArgs } from './editor-args.ts'
import { gameVite, type RunningGame, type StartGameOptions, startGame } from './game-runner.ts'
import { PLACES, type Place } from './places/place.ts'
import { type PublishOutcome, publishGame, runStep, scanBuildForEval } from './publish-game.ts'
import type { EditorServerOptions, RunningEditor } from './serve-editor.ts'

export interface EditorCommandIo {
  readonly stdout: (message: string) => void
  readonly stderr: (message: string) => void
}

export interface EditorCommandDeps {
  readonly serve: (options: EditorServerOptions) => Promise<RunningEditor>
  /** The build folder of the editors' page: the one that came with the tools when there is one, else the repository's. */
  readonly builtApp: () => string
  /** Whether this runs from a checkout of the AutomataFramework repository, where the page is built. */
  readonly inRepository: boolean
  readonly exists: (path: string) => boolean
  /** The machine's IPv4 addresses on the network, for the tablet's address. */
  readonly lanAddresses: () => readonly string[]
  readonly makeToken: () => string
  /** Resolves when the person stops the command (Ctrl+C). */
  readonly untilStopped: () => Promise<void>
  /** Starts the game in this folder as `pnpm dev` does, for Play and the Tuner; throws a sentence the person can act on. */
  readonly startGame: (root: string, options: StartGameOptions) => Promise<RunningGame>
  /** Builds the game in this folder and makes the zip to upload (the editor's Publish). */
  readonly publishGame: (root: string) => Promise<PublishOutcome>
  /** Where Publish can put the zip once it is made. */
  readonly places: readonly Place[]
  readonly cwd: string
}

const USAGE = `Usage: automata editor [folder] [--app-dir <build>] [--port <n>] [--lan] [--token <t>] [--game-url <address>]

Opens every editor on the game in <folder> (default: this folder) until you press Ctrl+C.
Only this computer can open it, unless you add --lan: then a tablet on your network can too, and a token is needed
(one is made for you if you give none). Open the address it prints, with the token in it.
The editor saves to the files listed in content/editors.toml, and it will not overwrite a file that changed while
you were editing. Without content/editors.toml, it opens only level files (*.af2d.json and *.af-sector.json).
It starts your game too, so Play and the Tuner can show it, and Publish builds it into a zip to upload.
With --lan the game is open to your network too, and it has no token: use --lan only on a network you trust.
If your game is already running (pnpm dev), give its address with --game-url and it starts no other.
`

/** Where the page with every editor is built, from the repository root, and the package that builds it. */
const BUILD = { folder: 'extensions/editors/dist/suite', pkg: '@automata/editors' } as const

const here = dirname(fileURLToPath(import.meta.url))

/** The name in the `package.json` of `dir`, if it has one. */
function packageName(dir: string): string | undefined {
  try {
    return (JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as { name?: unknown })
      .name as string
  } catch {
    return undefined
  }
}

/**
 * The AutomataFramework repository above `start`: the nearest folder whose `package.json` is named
 * `automata-framework`. A `pnpm-workspace.yaml` does not tell it from a game: a game installed from the registry is
 * often in a workspace of its own, and the tools run from inside its `node_modules`.
 */
export function findRepositoryRoot(
  start: string,
  readName: (dir: string) => string | undefined,
): string | undefined {
  for (let dir = start; ; dir = dirname(dir)) {
    if (readName(dir) === 'automata-framework') return dir
    if (dirname(dir) === dir) return undefined
  }
}

export async function editorCommand(
  args: readonly string[],
  io: EditorCommandIo,
  deps: EditorCommandDeps,
): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    io.stdout(USAGE)
    return 0
  }
  if (args.includes('--app')) {
    io.stderr(`Error: ${APP_IS_GONE}\n`)
    return 1
  }
  const parsed = parseEditorArgs(args)
  if (!parsed.ok) {
    io.stderr(`Error: ${parsed.problem}\n\n${USAGE}`)
    return 2
  }
  const { dir, appDir, port, lan, token, gameUrl } = parsed.options
  const root = resolve(deps.cwd, dir)
  const outside = appDir === undefined && !deps.inRepository
  const build = appDir === undefined ? deps.builtApp() : resolve(deps.cwd, appDir)
  if (!deps.exists(resolve(build, 'index.html'))) {
    io.stderr(
      outside
        ? 'Error: The editors are missing from this copy of the tools. Install them again: pnpm add -D @automata/tools\n'
        : `Error: no editor build at ${build}. Build it first: pnpm --filter ${BUILD.pkg} build\n`,
    )
    return 2
  }
  const secret = lan ? (token ?? deps.makeToken()) : token
  // The game runs beside the editor unless the person already runs it; a game that cannot start leaves the editor
  // working, with Play off and the reason printed.
  let game: RunningGame | undefined
  let gameProblem: string | undefined
  if (gameUrl === undefined) {
    // Vite can take a while on a cold cache; say so before waiting, so the silence is not mistaken for a hang.
    io.stdout('Starting your game…\n')
    try {
      game = await deps.startGame(root, { lan })
    } catch (error) {
      gameProblem = error instanceof Error ? error.message : String(error)
    }
  }
  let running: RunningEditor
  try {
    running = await deps.serve({
      root,
      appDir: build,
      host: lan ? '0.0.0.0' : '127.0.0.1',
      port,
      token: secret,
      gameUrl: gameUrl ?? game?.url,
      playOff: gameProblem,
      publish: () => deps.publishGame(root),
      places: deps.places,
    })
  } catch (error) {
    await game?.stop()
    io.stderr(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
  const query = secret === undefined ? '' : `/?token=${secret}`
  const { gameName } = await import('./serve-editor.ts')
  io.stdout(`Opened ${gameName(root)}.\n  This computer: ${running.url}${query}\n`)
  if (lan)
    for (const address of deps.lanAddresses())
      io.stdout(`  On the network: http://${address}:${running.port}${query}\n`)
  if (game !== undefined) io.stdout(`  Your game is running: ${game.url}\n`)
  // The editor's API wants the token; the game's own page is Vite's and has none. Say so where --lan is chosen.
  if (lan && game !== undefined)
    io.stdout(
      '  Anyone on your network can open your game and see its files, with no token. Use --lan only on a network you trust.\n',
    )
  if (gameProblem !== undefined) io.stdout(`  Play is off: ${gameProblem}\n`)
  io.stdout('Press Ctrl+C to stop.\n')
  await deps.untilStopped()
  await running.close()
  await game?.stop()
  return 0
}

/** The page packed next to the running bin (`dist/editors/suite` in the published tools), if this is a published copy. */
const packedPage = (): string | undefined => {
  const folder = resolve(here, 'editors/suite')
  return existsSync(resolve(folder, 'index.html')) ? folder : undefined
}

const repository = (): string | undefined => findRepositoryRoot(here, packageName)

/** The real dependencies: the editors' builds, this machine's network and Ctrl+C. */
export function liveEditorDeps(): EditorCommandDeps {
  return {
    // Loaded on use: the server reads the editor suite, whose sources Node cannot run from the workspace bin, and no
    // other command needs it.
    serve: async (options) => (await import('./serve-editor.ts')).serveEditor(options),
    builtApp: () => packedPage() ?? resolve(repository() ?? here, BUILD.folder),
    inRepository: repository() !== undefined,
    exists: existsSync,
    lanAddresses: () =>
      Object.values(networkInterfaces())
        .flatMap((list) => list ?? [])
        .filter((each) => each.family === 'IPv4' && !each.internal)
        .map((each) => each.address),
    makeToken: () => randomBytes(16).toString('hex'),
    untilStopped: () =>
      new Promise<void>((done) => {
        process.once('SIGINT', done)
        process.once('SIGTERM', done)
      }),
    startGame,
    publishGame: (root) =>
      publishGame(root, {
        vite: gameVite(root),
        bin: process.argv[1] ?? '',
        run: runStep,
        evalFindings: scanBuildForEval,
      }),
    places: PLACES,
    cwd: process.cwd(),
  }
}
