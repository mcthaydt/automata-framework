// Publish in the editor: one press builds the game for the web and hands back one zip the person can upload to
// itch.io (as an HTML game) or any web host. The steps are the ones a person would type: the game's own
// `vite build --mode itch`, then `automata ship prepare --target itch`, which checks the build (secrets, paths, itch.io's
// limits) and writes `<id>-<version>-itch.zip` beside it. A step that fails stops Publish, and its last lines go back
// to the editor under a sentence that says what to do.
import { spawn } from 'node:child_process'
import { NOT_INSTALLED } from './game-runner.ts'

export type PublishOutcome =
  | { readonly ok: true; readonly file: string }
  | { readonly ok: false; readonly problem: string; readonly detail: string }

/** One command Publish runs: Node with these arguments, in this folder. */
export interface PublishStep {
  readonly args: readonly string[]
  readonly cwd: string
}

export interface PublishDeps {
  /** The game's own `vite/bin/vite.js`; undefined when the game's packages are not installed. */
  readonly vite: string | undefined
  /** The `automata` command that is running (`process.argv[1]`). */
  readonly bin: string
  readonly run: (step: PublishStep) => Promise<{ readonly code: number; readonly output: string }>
}

const TAIL_LINES = 20
const tail = (output: string): string => output.trim().split('\n').slice(-TAIL_LINES).join('\n')

export async function publishGame(root: string, deps: PublishDeps): Promise<PublishOutcome> {
  if (deps.vite === undefined) return { ok: false, problem: NOT_INSTALLED, detail: '' }
  const build = await deps.run({
    args: [deps.vite, 'build', '--mode', 'itch', '--configLoader', 'runner'],
    cwd: root,
  })
  if (build.code !== 0)
    return {
      ok: false,
      problem: 'Your game did not build. Fix what the lines below say, then try again.',
      detail: tail(build.output),
    }
  const prepare = await deps.run({ args: [deps.bin, 'ship', 'prepare', '--target', 'itch'], cwd: root })
  const file = /^wrote (.+-itch\.zip)$/m.exec(prepare.output)?.[1]
  if (prepare.code !== 0 || file === undefined)
    return {
      ok: false,
      problem: 'Your game is not ready to put online yet. Fix what the lines below say, then try again.',
      detail: tail(prepare.output),
    }
  return { ok: true, file }
}

/** Runs a step with this Node, both outputs kept together in order. */
export function runStep(step: PublishStep): Promise<{ code: number; output: string }> {
  return new Promise((resolveRan) => {
    const child = spawn(process.execPath, step.args, { cwd: step.cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.on('error', (error) => resolveRan({ code: 1, output: `${output}\n${error.message}` }))
    child.on('close', (code) => resolveRan({ code: code ?? 1, output }))
  })
}
