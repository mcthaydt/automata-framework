// The real `automata editor`, as a game maker runs it: the built tools' bin on a game folder, on a free port. It
// resolves once the command prints its address, so a journey opens exactly what a person would open.
import { type ChildProcess, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** `packages/tools/dist/bin.js`: build the tools first (`pnpm --filter @automata/tools build`). */
export const BIN: string = fileURLToPath(new URL('../../../../tools/dist/bin.js', import.meta.url))

export interface RunningEditor {
  /** The address the command printed under "This computer". */
  readonly url: string
  /** Stops the command (Ctrl+C) and waits for it to exit. */
  readonly stop: () => Promise<void>
}

/** The address on the command's "This computer:" line, or undefined before it is printed. */
export function printedAddress(output: string): string | undefined {
  return /This computer: (http:\/\/\S+)/.exec(output)?.[1]
}

export function runEditor(gameDir: string, args: readonly string[] = []): Promise<RunningEditor> {
  // No page flag: the command picks the editors page by itself, as it does for a person. It also starts the game when
  // the game's packages are installed (a copy of Emberwick has none, so its editor opens with Play off).
  const child = spawn(process.execPath, [BIN, 'editor', gameDir, '--port', '0', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((resolve, reject) => {
    let output = ''
    const fail = (reason: string) => reject(new Error(`automata editor ${reason}:\n${output}`))
    // The command starts the game first and waits for it for up to a minute (`startGame`), so this waits longer: a
    // command that has printed no address in 90 s is stuck (the editor build is missing, or the port is taken).
    const timer = setTimeout(() => {
      child.kill()
      fail('printed no address in 90 s')
    }, 90_000)
    const read = (chunk: Buffer) => {
      output += chunk.toString()
      const url = printedAddress(output)
      if (url === undefined) return
      clearTimeout(timer)
      child.stdout?.off('data', read)
      resolve({ url, stop: () => stopProcess(child) })
    }
    child.stdout?.on('data', read)
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      fail(`exited with ${code} before printing its address`)
    })
  })
}

/** SIGINT, as Ctrl+C sends, then the exit. A process that has already exited resolves at once. */
export function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    child.once('exit', () => resolve())
    child.kill('SIGINT')
  })
}
