// The game beside the editor: `automata editor` starts the game the way `pnpm dev` does, so one command gives the
// person both the editor and a game to play, and Play and the Tuner have a page to show. The game's own Vite runs in
// the game's folder (the version the game installed, not ours), on a free port, and it is ready when its page answers:
// Vite prints its banner before it can serve, so the banner is not the signal.
import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'

export interface RunningGame {
  /** The game's page on this computer: `http://localhost:<port>/` (a tablet's editor swaps in the computer's address). */
  readonly url: string
  /** Stops the game's Vite and waits for it to exit. */
  readonly stop: () => Promise<void>
}

/** What the person reads when the game cannot run because nothing is installed. */
export const NOT_INSTALLED =
  'Your game’s packages are not installed. Run pnpm install in its folder, then start the editor again.'

const READY_WITHIN_MS = 60_000
const TAIL_CHARS = 2_000

/**
 * The game's own `vite/bin/vite.js`, in its `node_modules` (a game lists Vite among its own packages); undefined when
 * the game's packages are not installed. Only the game's folder is looked in: a Vite found further up or on
 * `NODE_PATH` would be some other project's.
 */
export function gameVite(root: string): string | undefined {
  const bin = join(root, 'node_modules/vite/bin/vite.js')
  return existsSync(bin) ? bin : undefined
}

/** A port nothing listens on now, picked by the system. */
function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, 'localhost', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      probe.close(() => resolvePort(port))
    })
  })
}

function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolveStopped) => {
    child.once('exit', () => resolveStopped())
    child.kill('SIGTERM')
  })
}

export interface StartGameOptions {
  /** Listen on every address, as the editor does with `--lan`, so a tablet on the network can open the game too. */
  readonly lan?: boolean | undefined
}

/** Starts the game in `root` and resolves once its page answers. Throws a sentence the person can act on. */
export async function startGame(root: string, options: StartGameOptions = {}): Promise<RunningGame> {
  const vite = gameVite(root)
  if (vite === undefined) throw new Error(NOT_INSTALLED)
  const port = await freePort()
  // `--configLoader runner` loads the game's vite.config.ts through Vite itself, so it works whether the framework's
  // packages are installed builds or a workspace's sources.
  const child = spawn(
    process.execPath,
    [
      vite,
      '--configLoader',
      'runner',
      '--strictPort',
      '--host',
      options.lan === true ? '0.0.0.0' : 'localhost',
      '--port',
      String(port),
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let said = ''
  const listen = (chunk: Buffer) => {
    said = (said + chunk.toString()).slice(-TAIL_CHARS)
  }
  child.stdout?.on('data', listen)
  child.stderr?.on('data', listen)
  const url = `http://localhost:${port}/`
  const deadline = Date.now() + READY_WITHIN_MS
  for (;;) {
    if (child.exitCode !== null) throw new Error(`Your game stopped before it started:\n${said.trim()}`)
    if (
      await fetch(url).then(
        (response) => response.ok,
        () => false,
      )
    )
      break
    if (Date.now() > deadline) {
      await stopChild(child)
      throw new Error(`Your game did not start within a minute:\n${said.trim()}`)
    }
    await new Promise((resolveSoon) => setTimeout(resolveSoon, 200))
  }
  return { url, stop: () => stopChild(child) }
}
