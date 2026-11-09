// The real `automata editor`, as a game maker runs it: the built tools' bin on a game folder, with this package's suite page
// in place of the core one. It resolves once the command has printed the editors' address and the game's, so a journey
// opens exactly what a person would open.
import { type ChildProcess, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** `packages/tools/dist/bin.js`: build the tools first (`pnpm --filter @automata/tools build`). */
export const BIN: string = fileURLToPath(
  new URL('../../../../../packages/tools/dist/bin.js', import.meta.url),
)
/** This package's built suite page (`pnpm --filter @automata/editors build`). */
export const SUITE_PAGE: string = fileURLToPath(new URL('../../../dist/suite', import.meta.url))

export interface RunningEditor {
  /** The address the command printed under "This computer": the editors. */
  readonly url: string
  /** The address of the game's own dev page, which the editor started. */
  readonly gameUrl: string
  /** Stops the command (Ctrl+C) and waits for it to exit. */
  readonly stop: () => Promise<void>
}

/** The editors' and the game's addresses in what the command printed, each undefined until its line is there. */
export function printedAddresses(output: string): { url?: string; gameUrl?: string } {
  const url = /This computer: (http:\/\/\S+)/.exec(output)?.[1]
  const gameUrl = /Your game is running: (http:\/\/\S+)/.exec(output)?.[1]
  return { ...(url === undefined ? {} : { url }), ...(gameUrl === undefined ? {} : { gameUrl }) }
}

export function runEditor(gameDir: string): Promise<RunningEditor> {
  const child = spawn(process.execPath, [BIN, 'editor', gameDir, '--port', '0', '--app-dir', SUITE_PAGE], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((resolve, reject) => {
    let output = ''
    const fail = (reason: string) => reject(new Error(`automata editor ${reason}:\n${output}`))
    // A command that has not printed both addresses in 60 s is stuck (a build is missing, or the game would not start).
    const timer = setTimeout(() => {
      child.kill()
      fail('did not print both addresses in 60 s')
    }, 60_000)
    const read = (chunk: Buffer) => {
      output += chunk.toString()
      const { url, gameUrl } = printedAddresses(output)
      if (url === undefined || gameUrl === undefined) return
      clearTimeout(timer)
      child.stdout?.off('data', read)
      resolve({ url, gameUrl, stop: () => stopProcess(child) })
    }
    child.stdout?.on('data', read)
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      fail(`exited with ${code} before printing its addresses`)
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
