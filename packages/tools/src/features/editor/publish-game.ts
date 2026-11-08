// Publish in the editor: one press checks the game, builds it for the web and hands back one zip the person can upload
// to itch.io (as an HTML game) or any web host. The steps are the ones a person would type: `automata check --only
// levels|inputs|orientation` (what the game's files say matches what the game does), the game's own `vite build --mode
// itch`, a scan of that build for code that runs text as code (the same scan as `automata check`'s `no-eval`, on the
// build that is being published), then `automata ship prepare --target itch`, which checks the build (secrets,
// paths, itch.io's limits) and writes `<id>-<version>-itch.zip` beside it. A step that fails stops Publish, and its
// last lines go back to the editor under a sentence that says what to do, with no colour codes and no stack frames.
import { spawn } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { scanForEval } from '../../shared/check/no-eval-scan.ts'
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
  /** Where the built game runs text as code, one line each, from the build Publish just made. */
  readonly evalFindings: (root: string) => Promise<readonly string[]>
}

const TAIL_LINES = 20
// ESC, then a colour or cursor code: the colours a build tool prints when it thinks a person is watching.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g')

/**
 * What a person can read of a step's output: no colour codes, no stack frames (`    at …`, which fill the screen and
 * say nothing a game maker can act on), and only the last lines, where the build says what stopped it.
 */
export function plainOutput(output: string): string {
  return output
    .replace(ANSI, '')
    .split('\n')
    .filter((line) => !/^\s+at /.test(line))
    .join('\n')
    .trim()
    .split('\n')
    .slice(-TAIL_LINES)
    .join('\n')
}

/** The checks of the game's own files that run before the build: each is `automata check --only <name>`. */
const CHECKS_BEFORE_BUILD = ['levels', 'inputs', 'orientation'] as const

/** The findings in `automata check --json`'s answer as plain lines (`file:line: what`), or the output's last lines if it is not that. */
function checkLines(output: string): string {
  try {
    const report = JSON.parse(output) as {
      steps: { findings: { file: string; line: number; message: string }[] }[]
    }
    const lines = report.steps.flatMap((step) =>
      step.findings.map(({ file, line, message }) =>
        [
          // A message that already begins with its file's name needs no second one in front.
          file === '' || message.startsWith(file) ? '' : line > 0 ? `${file}:${line}:` : `${file}:`,
          message,
        ]
          .filter(Boolean)
          .join(' '),
      ),
    )
    if (lines.length > 0) return lines.join('\n')
  } catch {
    // not JSON: the tool failed in a way it did not report; show what it said
  }
  return plainOutput(output)
}

export async function publishGame(root: string, deps: PublishDeps): Promise<PublishOutcome> {
  if (deps.vite === undefined) return { ok: false, problem: NOT_INSTALLED, detail: '' }
  for (const check of CHECKS_BEFORE_BUILD) {
    const checked = await deps.run({ args: [deps.bin, 'check', '--only', check, '--json'], cwd: root })
    if (checked.code !== 0)
      return {
        ok: false,
        problem:
          'Your game has something to fix before it can go online. Fix what the lines below say, then try again.',
        detail: checkLines(checked.output),
      }
  }
  const build = await deps.run({
    args: [deps.vite, 'build', '--mode', 'itch', '--configLoader', 'runner'],
    cwd: root,
  })
  if (build.code !== 0)
    return {
      ok: false,
      problem: 'Your game did not build. Fix what the lines below say, then try again.',
      detail: plainOutput(build.output),
    }
  const evals = await deps.evalFindings(root)
  if (evals.length > 0)
    return {
      ok: false,
      problem:
        'Part of your game runs text as code (eval), which itch.io and most web hosts do not allow. Fix what the lines below say, then try again.',
      detail: evals.join('\n'),
    }
  const prepare = await deps.run({ args: [deps.bin, 'ship', 'prepare', '--target', 'itch'], cwd: root })
  const file = /^wrote (.+-itch\.zip)$/m.exec(prepare.output)?.[1]
  if (prepare.code !== 0 || file === undefined)
    return {
      ok: false,
      problem: 'Your game is not ready to put online yet. Fix what the lines below say, then try again.',
      detail: plainOutput(prepare.output),
    }
  return { ok: true, file }
}

/** Where the game's build runs text as code (`eval`, `new Function`, a timer given a string), from its `dist/`. */
export async function scanBuildForEval(root: string): Promise<readonly string[]> {
  const dist = join(root, 'dist')
  const names = await readdir(dist, { recursive: true }).catch(() => [] as string[])
  const found: string[] = []
  for (const name of names.filter((each) => each.endsWith('.js')).sort()) {
    const file = `dist/${name.split('\\').join('/')}`
    // The scan's message ends with the one place that blocks it (Ruken's CSP); here the person is publishing to a web host.
    for (const finding of scanForEval(file, await readFile(join(dist, name), 'utf8')))
      found.push(`${file}:${finding.line}:${finding.col} ${finding.message.split(';')[0]}`)
  }
  return found
}

/** Runs a step with this Node, both outputs kept together in order. */
export function runStep(step: PublishStep): Promise<{ code: number; output: string }> {
  return new Promise((resolveRan) => {
    // NO_COLOR and FORCE_COLOR=0 ask the tools not to print colour codes into what the person reads.
    const child = spawn(process.execPath, step.args, {
      cwd: step.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    })
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
