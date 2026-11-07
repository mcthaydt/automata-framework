import { posix } from 'node:path'
import { Effect } from 'effect'
import type { CommandOutput } from './command-output.ts'
import { evidenceFileRefusal } from './evidence-file-reader.schema.ts'
import { git } from './git.ts'
import { Files, ProcessRunner } from './node-seams.ts'
import { isInside, isSymlink, resolvedPath } from './real-path.ts'

// Copies evidence a person approved from the git-ignored evidence folder into the committed baselines (ported from
// FloorFifty's `tools/promote-evidence`; plan M4.11). The two trees share a layout. With no path it lists what
// differs and copies nothing. Every path is checked before anything is copied, so a refused path leaves the
// baselines as they were.
//
// `Files` reads and writes UTF-8 text only, so a PNG cannot pass through it: files are compared with `cmp -s` and
// copied with `mkdir -p` and `cp`, through `ProcessRunner` (a request to core for binary `Files`; plan R1).
//
// Before anything is copied (plan DT-D6, DT-D8):
// - `--from` and `--to` must be relative folders without `..`, and `--to` must resolve inside the repository;
// - every target must be a plain file or missing (never a symlink) and resolve inside `--to`;
// - every selected file's provenance, the run's `evidence.json`, must pass `evidenceFileRefusal`: the nearest one
//   above the file inside the evidence folder, else the one core's collector writes at the repository root. A file
//   with neither is refused.

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
    for (const [flag, value] of [
      ['from', options.from],
      ['to', options.to],
    ] as const)
      if (value.startsWith('/') || value.split('/').includes('..'))
        return refused([`--${flag} must be a folder inside the repository: ${value}`])
    const top = yield* git(options.cwd, ['rev-parse', '--show-toplevel'])
    if (!top.ok) return refused([`not in a git checkout: ${top.message}`])
    const root = top.stdout.trim()
    const from = `${root}/${options.from}`
    const to = `${root}/${options.to}`
    const realTo = yield* resolvedPath(to)
    if (!isInside(realTo, yield* resolvedPath(root)))
      return refused([`--to resolves outside the repository: ${options.to}`])
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
    const provenances = new Map<string, string | null>()
    for (const selection of selections) {
      const reported = new Set<string>()
      for (const file of selection.files) {
        const provenance = yield* findProvenance(file, options.from, root)
        const refusal =
          provenance === null
            ? `no ${EVIDENCE_FILE} above it in ${options.from}/ or at the repository root; run the evidence collector`
            : yield* provenanceRefusal(`${root}/${provenance}`, provenances).pipe(
                Effect.map((reason) => (reason === null ? null : `${provenance}: ${reason}`)),
              )
        if (refusal !== null && !reported.has(refusal)) {
          reported.add(refusal)
          problems.push(`refused  ${selection.path}: ${refusal}`)
        }
        const target = `${to}/${file}`
        if (yield* isSymlink(target))
          problems.push(`refused  ${selection.path}: ${options.to}/${file} is a symlink`)
        else if (!isInside(yield* resolvedPath(target), realTo))
          problems.push(`refused  ${selection.path}: ${options.to}/${file} resolves outside ${options.to}/`)
      }
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

/**
 * The run's provenance for one evidence file, relative to the root: the nearest `evidence.json` in the file's folder
 * or a folder above it inside the evidence folder, else the root one core's collector writes; null when neither.
 */
function findProvenance(
  file: string,
  from: string,
  root: string,
): Effect.Effect<string | null, never, Files> {
  return Effect.gen(function* () {
    const files = yield* Files
    let dir = posix.dirname(file)
    for (;;) {
      const candidate = dir === '.' ? `${from}/${EVIDENCE_FILE}` : `${from}/${dir}/${EVIDENCE_FILE}`
      if (yield* files.exists(`${root}/${candidate}`)) return candidate
      if (dir === '.') break
      dir = posix.dirname(dir)
    }
    return (yield* files.exists(`${root}/${EVIDENCE_FILE}`)) ? EVIDENCE_FILE : null
  })
}

/** Why a provenance file refuses promotion, or null; each file is read once. */
function provenanceRefusal(
  path: string,
  cache: Map<string, string | null>,
): Effect.Effect<string | null, never, Files> {
  return Effect.gen(function* () {
    const known = cache.get(path)
    if (known !== undefined) return known
    const text = yield* (yield* Files).readText(path).pipe(Effect.either)
    const refusal = text._tag === 'Left' ? text.left.message : evidenceFileRefusal(text.right)
    cache.set(path, refusal)
    return refusal
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
