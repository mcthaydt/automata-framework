import { posix } from 'node:path'
import { Files, ProcessRunner } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import type { CommandOutput } from './command-output.ts'
import { evidenceFileRefusal } from './evidence-file-reader.schema.ts'
import { git } from './git.ts'

// Copies evidence a person approved from the git-ignored evidence folder into the committed baselines (ported from
// FloorFifty's `tools/promote-evidence`; plan M4.11). The two trees share a layout. With no path it lists what
// differs and copies nothing. Every path is checked before anything is copied, so a refused path leaves the
// baselines as they were.
//
// `Files` reads and writes UTF-8 text only, so a PNG cannot pass through it: files are compared with `cmp -s` and
// copied with `mkdir -p` and `cp`, through `ProcessRunner` (a request to core for binary `Files`; plan R1).

export interface PromoteOptions {
  /** Where it runs from; the folders are relative to its checkout's root. */
  readonly cwd: string
  /** The git-ignored folder the evidence specs write to. */
  readonly from: string
  /** The committed baselines folder. */
  readonly to: string
  /** Files or set folders, relative to `from`; none lists what differs. */
  readonly paths: readonly string[]
}

const EVIDENCE_FILE = 'evidence.json'

export function promoteEvidence(
  options: PromoteOptions,
): Effect.Effect<CommandOutput, never, Files | ProcessRunner> {
  return Effect.gen(function* () {
    const files = yield* Files
    const top = yield* git(options.cwd, ['rev-parse', '--show-toplevel'])
    if (!top.ok) return refused([`not in a git checkout: ${top.message}`])
    const root = top.stdout.trim()
    const from = `${root}/${options.from}`
    const to = `${root}/${options.to}`
    if (!(yield* files.exists(from))) return refused([`no ${options.from}/ here: run an evidence spec first`])
    const listed = yield* files.listFiles(from).pipe(Effect.either)
    if (listed._tag === 'Left') return failed([listed.left.message])
    // Dot files (.DS_Store, .gitkeep) are not evidence.
    const evidence = listed.right.filter((file) => !posix.basename(file).startsWith('.'))

    if (options.paths.length === 0) return yield* listDifferences(evidence, from, to)

    const problems: string[] = []
    const selections: Array<{ path: string; files: string[] }> = []
    for (const raw of options.paths) {
      const path = raw.replace(/\/+$/, '')
      if (path.startsWith('/') || path.split('/').includes('..')) {
        problems.push(`outside ${options.from}/: ${raw}`)
        continue
      }
      const selected = evidence.filter((file) => file === path || file.startsWith(`${path}/`))
      if (selected.length === 0) problems.push(`not in ${options.from}/: ${raw}`)
      else selections.push({ path, files: selected })
    }
    for (const file of selections.flatMap((selection) => selection.files)) {
      if (posix.basename(file) !== EVIDENCE_FILE) continue
      const text = yield* files.readText(`${from}/${file}`).pipe(Effect.either)
      const refusal = text._tag === 'Left' ? text.left.message : evidenceFileRefusal(text.right)
      if (refusal !== null) problems.push(`refused  ${file}: ${refusal}`)
    }
    if (problems.length > 0) return refused([...problems, 'nothing promoted'])

    const promoted: string[] = []
    for (const selection of selections) {
      for (const file of selection.files) {
        const copied = yield* copy(`${from}/${file}`, `${to}/${file}`)
        if (copied !== null)
          return { exit: 1, stdout: lines(promoted), stderr: lines([`could not copy ${file}: ${copied}`]) }
      }
      promoted.push(`promoted ${selection.path}`)
    }
    return { exit: 0, stdout: lines(promoted), stderr: '' }
  })
}

const lines = (list: readonly string[]): string => (list.length === 0 ? '' : `${list.join('\n')}\n`)
const refused = (messages: readonly string[]): CommandOutput => ({
  exit: 2,
  stdout: '',
  stderr: lines(messages),
})
const failed = (messages: readonly string[]): CommandOutput => ({
  exit: 1,
  stdout: '',
  stderr: lines(messages),
})

/** `new` for a file with no baseline, `changed` for one whose bytes differ; the same files are not listed. */
function listDifferences(
  evidence: readonly string[],
  from: string,
  to: string,
): Effect.Effect<CommandOutput, never, Files | ProcessRunner> {
  return Effect.gen(function* () {
    const files = yield* Files
    const runner = yield* ProcessRunner
    const found: string[] = []
    for (const file of evidence) {
      if (!(yield* files.exists(`${to}/${file}`))) {
        found.push(`new      ${file}`)
        continue
      }
      const compared = yield* runner
        .run('cmp', ['-s', `${from}/${file}`, `${to}/${file}`])
        .pipe(Effect.either)
      if (compared._tag === 'Left') return failed([compared.left.message])
      // cmp exits 0 for the same bytes, 1 for different ones and 2 when it could not compare.
      if (compared.right.exitCode === 1) found.push(`changed  ${file}`)
      else if (compared.right.exitCode !== 0)
        return failed([`cmp could not compare ${file}: ${compared.right.stderr.trim()}`])
    }
    return { exit: 0, stdout: lines(found), stderr: '' }
  })
}

/** Copies one file's bytes, creating its folder; null when it worked, else why not. */
function copy(source: string, target: string): Effect.Effect<string | null, never, ProcessRunner> {
  return Effect.gen(function* () {
    const runner = yield* ProcessRunner
    for (const [command, args] of [
      ['mkdir', ['-p', posix.dirname(target)]],
      ['cp', [source, target]],
    ] as const) {
      const result = yield* runner.run(command, args).pipe(Effect.either)
      if (result._tag === 'Left') return result.left.message
      if (result.right.exitCode !== 0)
        return result.right.stderr.trim() || `${command} exited ${result.right.exitCode}`
    }
    return null
  })
}
