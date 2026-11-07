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

const USAGE = `Usage: automata editor [dir] [--app 2d|3d|suite] [--app-dir <build>] [--port <n>] [--lan] [--token <t>]

Serves an editor against the game checkout in <dir> (default: the working folder) until Ctrl+C. It listens on the
loopback only; --lan listens on the network so a tablet can open it, and then needs a token (made if you give none): open
the address it prints, with the token in it. The editor reads and writes the files content/editors.toml lists (a
checkout without one: its .json files), with a check that a file did not change on disk since the editor read it.
`

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
    io.stderr(
      `Error: no editor build at ${build}. Build it first: pnpm --filter @mcthaydt/automata-editor-${app} build\n`,
    )
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

/** The real dependencies: the repository's `packages/editor-<app>/dist`, this machine's network and Ctrl+C. */
export function liveEditorDeps(): EditorCommandDeps {
  return {
    serve: serveEditor,
    builtApp: (app) => resolve(repositoryRoot(), `packages/editor-${app}`, 'dist'),
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
