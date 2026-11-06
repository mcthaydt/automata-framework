// `automata editor`: serve an editor against a game checkout, on the loopback by default, or on the
// network with a token (`--lan`) so a tablet can open it. The server is `serve-editor.ts`; this is the command around it:
// which build to serve, what to print, and when to refuse. The dependencies are injected so the tests run no server.
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type EditorApp, parseEditorArgs } from './editor-args.ts'
import { type EditorServerOptions, type RunningEditor, serveEditor } from './serve-editor.ts'

export interface EditorCommandIo {
  readonly stdout: (message: string) => void
  readonly stderr: (message: string) => void
}

export interface EditorCommandDeps {
  readonly serve: (options: EditorServerOptions) => Promise<RunningEditor>
  /** The build folder of an editor: the 2D editor that came with the tools when there is one, else the repository's. */
  readonly builtApp: (app: EditorApp) => string
  /** Whether this runs from a checkout of the AutomataFramework repository, where the 3D editors are built. */
  readonly inRepository: boolean
  readonly exists: (path: string) => boolean
  /** The machine's IPv4 addresses on the network, for the tablet's address. */
  readonly lanAddresses: () => readonly string[]
  readonly makeToken: () => string
  /** Resolves when the person stops the command (Ctrl+C). */
  readonly untilStopped: () => Promise<void>
  readonly cwd: string
}

const USAGE = `Usage: automata editor [folder] [--app 2d|3d|suite] [--app-dir <build>] [--port <n>] [--lan] [--token <t>]
       [--game-url <address>]

Opens the level editor on the game in <folder> (default: this folder) until you press Ctrl+C.
Only this computer can open it, unless you add --lan: then a tablet on your network can too, and a token is needed
(one is made for you if you give none). Open the address it prints, with the token in it.
The editor saves to the files listed in content/editors.toml, and it will not overwrite a file that changed while
you were editing. Without content/editors.toml, it opens only level files (*.af2d.json).
The Tuner shows your game beside its settings: start it with pnpm dev, and give --game-url if it is not on
http://localhost:5173.
`

/** Where each editor's build is, from the repository root, and the package that builds it. */
const BUILDS: Readonly<Record<EditorApp, { readonly folder: string; readonly pkg: string }>> = {
  '2d': { folder: 'packages/editor/dist/2d', pkg: '@mcthaydt/automata-editor' },
  '3d': { folder: 'packages/editor-3d/dist', pkg: '@mcthaydt/automata-editor-3d' },
  // The suite's 2D page: the level editor and the Tuner. The full suite, with the 3D editors, is editor-3d's
  // `dist/suite`, served with --app-dir.
  suite: { folder: 'packages/editor/dist/suite', pkg: '@mcthaydt/automata-editor' },
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
  // The 3D editor and the suite are built in the repository only; a published copy of the tools has just the level
  // editor.
  if (app !== '2d' && appDir === undefined && !deps.inRepository) {
    io.stderr(
      app === 'suite'
        ? 'Error: The editor suite is not in this release yet. Run automata editor to open the level editor.\n'
        : 'Error: The 3D editor is not in this release yet.\n',
    )
    return 2
  }
  const root = resolve(deps.cwd, dir)
  const build = appDir === undefined ? deps.builtApp(app) : resolve(deps.cwd, appDir)
  if (!deps.exists(resolve(build, 'index.html'))) {
    io.stderr(`Error: no editor build at ${build}. Build it first: pnpm --filter ${BUILDS[app].pkg} build\n`)
    return 2
  }
  const secret = lan ? (token ?? deps.makeToken()) : token
  let running: RunningEditor
  try {
    running = await deps.serve({
      root,
      appDir: build,
      host: lan ? '0.0.0.0' : '127.0.0.1',
      port,
      token: secret,
      gameUrl,
    })
  } catch (error) {
    io.stderr(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
  const query = secret === undefined ? '' : `/?token=${secret}`
  io.stdout(`Editing ${root} with the ${app} editor.\n  This computer: ${running.url}${query}\n`)
  if (lan)
    for (const address of deps.lanAddresses())
      io.stdout(`  On the network: http://${address}:${running.port}${query}\n`)
  io.stdout('Press Ctrl+C to stop.\n')
  await deps.untilStopped()
  await running.close()
  return 0
}

/** The 2D editor packed next to the running bin (`dist/editors/2d` in the published tools), if this is a published copy. */
const packedEditor = (): string | undefined => {
  const folder = resolve(here, 'editors/2d')
  return existsSync(resolve(folder, 'index.html')) ? folder : undefined
}

const isRepository = (): boolean => existsSync(resolve(repositoryRoot(), 'pnpm-workspace.yaml'))

/** The real dependencies: the editors' builds, this machine's network and Ctrl+C. */
export function liveEditorDeps(): EditorCommandDeps {
  return {
    serve: serveEditor,
    builtApp: (app) =>
      (app === '2d' ? packedEditor() : undefined) ?? resolve(repositoryRoot(), BUILDS[app].folder),
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
    cwd: process.cwd(),
  }
}
