// The game beside the editor: `automata editor` starts the game the way `pnpm dev` does, so one command gives the
// person both the editor and a game to play, and Play and the Tuner have a page to show. The game's own Vite runs in
// the game's folder (the version the game installed, not ours), on a free port, and it is ready when its page answers:
// Vite prints its banner before it can serve, so the banner is not the signal.
import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'

export interface RunningGame {
  /** The game's page: `http://localhost:<port>/`. */
  readonly url: string
  /** Stops the game's Vite and waits for it to exit. */
  readonly stop: () => Promise<void>
}

/** What the person reads when the game cannot run because nothing is installed. */
export const NOT_INSTALLED =
  'Your game’s packages are not installed. Run pnpm install in its folder, then start the editor again.'

const READY_WITHIN_MS = 60_000
/** How much of the game's output is kept: its start, because Vite prints the cause first and a long stack after it. */
const KEPT_CHARS = 4_000
const CAUSE_CHARS = 300

/**
 * The game's own `vite/bin/vite.js`, in its `node_modules` (a game lists Vite among its own packages); undefined when
 * the game's packages are not installed. Only the game's folder is looked in: a Vite found further up or on
 * `NODE_PATH` would be some other project's.
 */
export function gameVite(root: string): string | undefined {
  const bin = join(root, 'node_modules/vite/bin/vite.js')
  return existsSync(bin) ? bin : undefined
}

/**
 * The one line that says why the game stopped, in plain words: the message of the first error line (Vite prints
 * "Error: Cannot find module 'x' imported from …" ahead of its stack), else the first line that is not a stack frame.
 */
export function whyItStopped(output: string): string {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const error = lines.find((line) => /^\w*Error: /.test(line))
  const cause = error?.replace(/^\w*Error: /, '') ?? lines.find((line) => !line.startsWith('at ')) ?? ''
  return cause.slice(0, CAUSE_CHARS).replace(/\.$/, '') || 'it printed nothing'
}

/**
 * The step `pnpm dev` runs before Vite: the game's own `fonts` script (`automata-content assets`), which writes what
 * its main.ts imports into the git-ignored `content/generated/`. Without it a game that was never started with
 * `pnpm dev` has a page that is a 500. The script is read from the game's package.json, so the two cannot drift, and
 * the command is the content package the game installed, as Vite is the game's own. A game with no such script (the 3D
 * game) has nothing to prepare. Throws a sentence the person can act on.
 */
async function prepareGame(root: string): Promise<void> {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }
  const [command, ...args] = (manifest.scripts?.fonts ?? '').split(' ')
  if (command !== 'automata-content') return
  const content = join(root, 'node_modules/@automata/content')
  const bin = (
    JSON.parse(readFileSync(join(content, 'package.json'), 'utf8')) as { bin?: Record<string, string> }
  ).bin?.['automata-content']
  if (bin === undefined) throw new Error(NOT_INSTALLED)
  const child = spawn(process.execPath, [join(content, bin), ...args], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let said = ''
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk: Buffer) => {
      said = (said + chunk.toString()).slice(0, KEPT_CHARS)
    })
  const code = await new Promise<number | null>((resolveCode) => child.once('close', resolveCode))
  if (code !== 0)
    throw new Error(
      `Your game’s fonts could not be made: ${whyItStopped(said)}.\nFix that in the game, then start the editor again.`,
    )
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

/** Starts the game in `root` and resolves once its page answers. Throws a sentence the person can act on. */
export async function startGame(root: string): Promise<RunningGame> {
  const vite = gameVite(root)
  if (vite === undefined) throw new Error(NOT_INSTALLED)
  await prepareGame(root)
  const port = await freePort()
  // `--configLoader runner` loads the game's vite.config.ts through Vite itself, so it works whether the framework's
  // packages are installed builds or a workspace's sources.
  const child = spawn(
    process.execPath,
    [vite, '--configLoader', 'runner', '--strictPort', '--host', 'localhost', '--port', String(port)],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let said = ''
  const listen = (chunk: Buffer) => {
    said = (said + chunk.toString()).slice(0, KEPT_CHARS)
  }
  child.stdout?.on('data', listen)
  child.stderr?.on('data', listen)
  const url = `http://localhost:${port}/`
  const deadline = Date.now() + READY_WITHIN_MS
  for (;;) {
    if (child.exitCode !== null)
      throw new Error(
        `Your game stopped before it started: ${whyItStopped(said)}.\nFix that in the game, then start the editor again.`,
      )
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
