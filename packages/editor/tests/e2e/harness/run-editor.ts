// The real `automata editor`, as a game maker runs it: the built tools' bin on a game folder, on a free port. It
// resolves once the command has printed its whole opening (the address, and whether the game runs beside it), so a
// journey opens exactly what a person would open.
import { type ChildProcess, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** `packages/tools/dist/bin.js`: build the tools first (`pnpm --filter @automata/tools build`). */
export const BIN: string = fileURLToPath(new URL('../../../../tools/dist/bin.js', import.meta.url))

export interface RunningEditor {
  /** The address the command printed under "This computer". */
  readonly url: string
  /** Why Play is off, in the command's words, when the game beside the editor did not start; undefined when it runs. */
  readonly playOff: string | undefined
  /** Stops the command (Ctrl+C) and waits for it to exit. */
  readonly stop: () => Promise<void>
}

/** The address on the command's "This computer:" line, or undefined before it is printed. */
export function printedAddress(output: string): string | undefined {
  return /This computer: (http:\/\/\S+)/.exec(output)?.[1]
}

/** Why Play is off, from the command's "Play is off:" line, or undefined while the game runs (or before it is printed). */
export function printedPlayOff(output: string): string | undefined {
  return /Play is off: (.+)/.exec(output)?.[1]
}

/** The last line of the command's opening. */
const OPENED = 'Press Ctrl+C to stop.'

export function runEditor(gameDir: string, args: readonly string[] = []): Promise<RunningEditor> {
  // No `--app`: the command opens the editors page by itself, as it does for a person. It also starts the game when
  // the game's packages are installed (a copy of Emberwick has none, so its editor opens with Play off).
  const child = spawn(process.execPath, [BIN, 'editor', gameDir, '--port', '0', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((resolve, reject) => {
    let output = ''
    const fail = (reason: string) => reject(new Error(`automata editor ${reason}:\n${output}`))
    // A command that has printed nothing in 30 s is stuck (the editor build is missing, or the port is taken).
    const timer = setTimeout(() => {
      child.kill()
      fail('printed no address in 30 s')
    }, 30_000)
    const read = (chunk: Buffer) => {
      output += chunk.toString()
      // The opening ends with this line, after the address and the game's state: Play-off arrives in the same breath.
      const url = printedAddress(output)
      if (url === undefined || !output.includes(OPENED)) return
      clearTimeout(timer)
      child.stdout?.off('data', read)
      resolve({ url, playOff: printedPlayOff(output), stop: () => stopProcess(child) })
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

/**
 * `runEditor` for a journey that clicks Play: if the game beside the editor did not start, the journey fails here, at
 * once, with the game's own error, not 3 minutes later on a Play link that was never shown.
 */
export async function runEditorWithPlay(gameDir: string): Promise<RunningEditor> {
  const editor = await runEditor(gameDir)
  if (editor.playOff === undefined) return editor
  await editor.stop()
  throw new Error(`Play is off, so this journey cannot run: ${editor.playOff}`)
}
