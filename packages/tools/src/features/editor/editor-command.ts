// `automata editor`: serve an editor against a game checkout, on the loopback by default, or on the
// network with a token (`--lan`) so a tablet can open it. The server is `serve-editor.ts`; this is the command around it:
// which build to serve, what to print, and when to refuse. The dependencies are injected so the tests run no server.
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type EditorApp, parseEditorArgs } from './editor-args.ts'
import type { EditorServerOptions, RunningEditor } from './serve-editor.ts'

export interface EditorCommandIo {
  readonly stdout: (message: string) => void
  readonly stderr: (message: string) => void
}

export interface EditorCommandDeps {
  readonly serve: (options: EditorServerOptions) => Promise<RunningEditor>
  /** The repository's build folder of an editor. */
  readonly builtApp: (app: EditorApp) => string
  readonly exists: (path: string) => boolean
  /** The machine's IPv4 addresses on the network, for the tablet's address. */
  readonly lanAddresses: () => readonly string[]
  readonly makeToken: () => string
  /** Resolves when the person stops the command (Ctrl+C). */
  readonly untilStopped: () => Promise<void>
  readonly cwd: string
}

const USAGE = `Usage: automata editor [folder] [--app 2d|3d|suite] [--app-dir <build>] [--port <n>] [--lan] [--token <t>]

Opens an editor on the game in <folder> (default: this folder) until you press Ctrl+C.
Only this computer can open it, unless you add --lan: then a tablet on your network can too, and a token is needed
(one is made for you if you give none). Open the address it prints, with the token in it.
The editor saves to the files listed in content/editors.toml (or the .json files, if there is none), and it will not
overwrite a file that changed while you were editing.
`

/** Where each editor's build is, from the repository root, and the package that builds it. */
const BUILDS: Readonly<Record<EditorApp, { readonly folder: string; readonly pkg: string }>> = {
  '2d': { folder: 'packages/editor/dist/2d', pkg: '@mcthaydt/automata-editor' },
  '3d': { folder: 'packages/editor-3d/dist', pkg: '@mcthaydt/automata-editor-3d' },
  suite: { folder: 'packages/editor-3d/dist/suite', pkg: '@mcthaydt/automata-editor-3d' },
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
  const { dir, app, appDir, port, lan, token } = parsed.options
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

/** The real dependencies: the repository's build of each editor, this machine's network and Ctrl+C. */
export function liveEditorDeps(): EditorCommandDeps {
  return {
    // Loaded on use: the server reads the editor suite, whose sources Node cannot run from the workspace bin, and no
    // other command needs it.
    serve: async (options) => (await import('./serve-editor.ts')).serveEditor(options),
    builtApp: (app) => resolve(repositoryRoot(), BUILDS[app].folder),
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
