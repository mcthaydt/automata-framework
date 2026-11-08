// `automata editor`: serve an editor against a game checkout, on the loopback by default, or on the
// network with a token (`--lan`) so a tablet can open it. The server is `serve-editor.ts`; this is the command around it:
// which build to serve, what to print, and when to refuse. The dependencies are injected so the tests run no server.
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type EditorApp, parseEditorArgs } from './editor-args.ts'
import { gameVite, type RunningGame, startGame } from './game-runner.ts'
import { type PublishOutcome, publishGame, runStep } from './publish-game.ts'
import { type EditorServerOptions, gameName, type RunningEditor, serveEditor } from './serve-editor.ts'

export interface EditorCommandIo {
  readonly stdout: (message: string) => void
  readonly stderr: (message: string) => void
}

export interface EditorCommandDeps {
  readonly serve: (options: EditorServerOptions) => Promise<RunningEditor>
  /** The build folder of an editor: the one that came with the tools when there is one (2D and the suite), else the repository's. */
  readonly builtApp: (app: EditorApp) => string
  /** Whether this runs from a checkout of the AutomataFramework repository, where the 3D editors are built. */
  readonly inRepository: boolean
  readonly exists: (path: string) => boolean
  /** The machine's IPv4 addresses on the network, for the tablet's address. */
  readonly lanAddresses: () => readonly string[]
  readonly makeToken: () => string
  /** Resolves when the person stops the command (Ctrl+C). */
  readonly untilStopped: () => Promise<void>
  /** Starts the game in this folder as `pnpm dev` does, for Play and the Tuner; throws a sentence the person can act on. */
  readonly startGame: (root: string) => Promise<RunningGame>
  /** Builds the game in this folder and makes the zip to upload (the editor's Publish). */
  readonly publishGame: (root: string) => Promise<PublishOutcome>
  readonly cwd: string
}

const USAGE = `Usage: automata editor [folder] [--app 2d|3d|suite] [--app-dir <build>] [--port <n>] [--lan] [--token <t>]
       [--game-url <address>]

Opens the editors on the game in <folder> (default: this folder) until you press Ctrl+C.
Only this computer can open it, unless you add --lan: then a tablet on your network can too, and a token is needed
(one is made for you if you give none). Open the address it prints, with the token in it.
The editor saves to the files listed in content/editors.toml, and it will not overwrite a file that changed while
you were editing. Without content/editors.toml, it opens only level files (*.af2d.json and *.af-sector.json).
It starts your game too, so Play and the Tuner can show it, and Publish builds it into a zip to upload.
If your game is already running (pnpm dev), give its address with --game-url and it starts no other.
`

/** Where each editor's build is, from the repository root, and the package that builds it. */
const BUILDS: Readonly<Record<EditorApp, { readonly folder: string; readonly pkg: string }>> = {
  '2d': { folder: 'packages/editor/dist/2d', pkg: '@automata/editor' },
  '3d': { folder: 'packages/editor-3d/dist', pkg: '@automata/editor-3d' },
  // The suite's 2D page: the level editor and the Tuner, packed in the published tools too. The full suite, with
  // the 3D editors, is editor-3d's `dist/suite`, served with --app-dir.
  suite: { folder: 'packages/editor/dist/suite', pkg: '@automata/editor' },
}

const here = dirname(fileURLToPath(import.meta.url))

/** The repository's root: the nearest folder above this file with a `pnpm-workspace.yaml` (source and build sit at different depths). */
function repositoryRoot(): string {
  for (let dir = here; dirname(dir) !== dir; dir = dirname(dir))
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir
  return resolve(here, '../../../..')
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
  const parsed = parseEditorArgs(args)
  if (!parsed.ok) {
    io.stderr(`Error: ${parsed.problem}\n\n${USAGE}`)
    return 2
  }
  const { dir, app, appDir, port, lan, token, gameUrl } = parsed.options
  const root = resolve(deps.cwd, dir)
  const build = appDir === undefined ? deps.builtApp(app) : resolve(deps.cwd, appDir)
  // The 3D editor is built in the repository only. A published copy of the tools packs the level editor and the suite's
  // 2D page (the Tuner); a copy without the suite's page says so rather than naming a build folder it never had.
  if (
    app !== '2d' &&
    appDir === undefined &&
    !deps.inRepository &&
    (app === '3d' || !deps.exists(resolve(build, 'index.html')))
  ) {
    io.stderr(
      app === 'suite'
        ? 'Error: The editors are missing from this copy of the tools. Install them again: pnpm add -D @automata/tools\n'
        : 'Error: The 3D editor is not in this release yet.\n',
    )
    return 2
  }
  if (!deps.exists(resolve(build, 'index.html'))) {
    io.stderr(`Error: no editor build at ${build}. Build it first: pnpm --filter ${BUILDS[app].pkg} build\n`)
    return 2
  }
  const secret = lan ? (token ?? deps.makeToken()) : token
  // The game runs beside the editor unless the person already runs it; a game that cannot start leaves the editor
  // working, with Play off and the reason printed.
  let game: RunningGame | undefined
  let gameProblem: string | undefined
  if (gameUrl === undefined)
    try {
      game = await deps.startGame(root)
    } catch (error) {
      gameProblem = error instanceof Error ? error.message : String(error)
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
      publish: () => deps.publishGame(root),
    })
  } catch (error) {
    await game?.stop()
    io.stderr(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
  const query = secret === undefined ? '' : `/?token=${secret}`
  io.stdout(`Opened ${gameName(root)}.\n  This computer: ${running.url}${query}\n`)
  if (lan)
    for (const address of deps.lanAddresses())
      io.stdout(`  On the network: http://${address}:${running.port}${query}\n`)
  if (game !== undefined) io.stdout(`  Your game is running: ${game.url}\n`)
  if (gameProblem !== undefined) io.stdout(`  Play is off: ${gameProblem}\n`)
  io.stdout('Press Ctrl+C to stop.\n')
  await deps.untilStopped()
  await running.close()
  await game?.stop()
  return 0
}

/** An editor packed next to the running bin (`dist/editors/2d` and `dist/editors/suite` in the published tools), if this is a published copy. */
const packedEditor = (app: 'suite' | '2d'): string | undefined => {
  const folder = resolve(here, `editors/${app}`)
  return existsSync(resolve(folder, 'index.html')) ? folder : undefined
}

const isRepository = (): boolean => existsSync(resolve(repositoryRoot(), 'pnpm-workspace.yaml'))

/** The real dependencies: the editors' builds, this machine's network and Ctrl+C. */
export function liveEditorDeps(): EditorCommandDeps {
  return {
    serve: serveEditor,
    builtApp: (app) =>
      (app === '3d' ? undefined : packedEditor(app)) ?? resolve(repositoryRoot(), BUILDS[app].folder),
    inRepository: isRepository(),
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
      publishGame(root, { vite: gameVite(root), bin: process.argv[1] ?? '', run: runStep }),
    cwd: process.cwd(),
  }
}
