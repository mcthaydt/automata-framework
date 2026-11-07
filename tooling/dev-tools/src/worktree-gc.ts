import { Effect } from 'effect'
import type { CommandExit, CommandOutput } from './command-output.ts'
import { git } from './git.ts'
import { Files, ProcessRunner } from './node-seams.ts'
import { type ProcessTable, pidsInside, runningProcesses } from './running-processes.ts'
import { parseWorktreeList, type WorktreeRecord } from './worktree-list.ts'

// Tidies the worktrees of the repository it runs in (ported from FloorFifty's `tools/worktree-gc`; plan M4.11).
// It reports by default and changes nothing without `apply`. What it may do with `apply`:
// - remove a worktree that is merged into the base, on a remote, clean and idle, then delete its branch with
//   `git branch -d` (which refuses an unmerged one). It never passes `--force`, so git refuses a dirty tree too;
// - remove regenerated test output (SCRATCH) in a worktree that is neither locked nor in use;
// - drop git's records of worktrees whose folder is gone (`git worktree prune`).
// Never touched: the main checkout, the checkout it runs from, a locked worktree, one with a running process (or
// any, when processes cannot be checked), one with uncommitted changes, commits not in the base or commits on no
// remote, and a folder under .claude/worktrees that git does not know (an orphan: reported for a person).

export interface WorktreeGcOptions {
  /** Act on the report; without it nothing changes. */
  readonly apply: boolean
  /** The branch a worktree must be merged into: `origin/<base>` after a fetch, else the local `<base>`. */
  readonly base: string
  /** Where it runs from: its checkout is "this checkout". */
  readonly cwd: string
}

/** Test output a run regenerates, often a gigabyte: removed from an unlocked, idle worktree. */
const SCRATCH = ['playwright-report', 'test-results'] as const
/**
 * Ignored folders a worktree may lose without losing work, because a command regenerates them (plan DT-D7):
 * installs, build output, core's packs and test output. Matched as a whole path segment anywhere
 * (`packages/x/node_modules/`). Any other ignored path (captured `evidence/`, a `.env`) exists only in that
 * worktree, and `git worktree remove` deletes ignored files even without `--force`, so it keeps the worktree.
 */
const REGENERATED = new Set(['node_modules', '.turbo', 'dist', '.core', '.evidence', ...SCRATCH])
const isRegenerated = (path: string): boolean =>
  path
    .replace(/\/$/, '')
    .split('/')
    .some((segment) => REGENERATED.has(segment))

/** Where agents' worktrees live, for the orphan report. */
const WORKTREES_DIR = '.claude/worktrees'

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

export function worktreeGc(
  options: WorktreeGcOptions,
): Effect.Effect<CommandOutput, never, Files | ProcessRunner> {
  return Effect.gen(function* () {
    const files = yield* Files
    const lines: string[] = []
    let exit: CommandExit = 0

    const top = yield* git(options.cwd, ['rev-parse', '--show-toplevel'])
    if (!top.ok) return { exit: 2, stdout: '', stderr: `not in a git checkout: ${top.message}\n` }
    const here = top.stdout.trim()
    const list = yield* git(here, ['worktree', 'list', '--porcelain'])
    if (!list.ok) return { exit: 1, stdout: '', stderr: `git worktree list failed: ${list.message}\n` }
    const records = parseWorktreeList(list.stdout)
    const main = records[0]?.path ?? here
    const name = (path: string): string => (path.startsWith(`${main}/`) ? path.slice(main.length + 1) : path)

    const fetched = yield* git(main, ['fetch', '-q', 'origin', options.base])
    const base = fetched.ok ? `origin/${options.base}` : options.base
    lines.push(fetched.ok ? `base: ${base}` : `base: ${base} (fetch from origin failed)`)

    const prune = yield* git(main, ['worktree', 'prune', '--dry-run', '-v'])
    if (prune.ok) lines.push(...prune.stdout.split('\n').filter((line) => line.trim() !== ''))
    if (options.apply) {
      const pruned = yield* git(main, ['worktree', 'prune'])
      if (!pruned.ok) {
        lines.push(`failed   git worktree prune: ${pruned.message}`)
        exit = 1
      }
    }

    const processes = yield* runningProcesses()
    for (const record of records.slice(1)) {
      if (record.bare || record.prunable || !(yield* files.exists(record.path))) continue
      const pids = pidsInside(processes, record.path)
      const idle = pids !== null && pids.length === 0

      for (const folder of SCRATCH) {
        const scratch = `${record.path}/${folder}`
        if (!(yield* files.exists(scratch))) continue
        const label = `scratch  ${name(scratch)}`
        if (record.locked) lines.push(`${label} (locked: left)`)
        else if (!idle) lines.push(`${label} (running process: left)`)
        else {
          lines.push(label)
          if (options.apply) {
            const removed = yield* files.remove(scratch).pipe(Effect.either)
            if (removed._tag === 'Left') {
              lines.push(`failed   ${name(scratch)}: ${removed.left.message}`)
              exit = 1
            }
          }
        }
      }

      const reason = yield* keepReason(record, { here, base, processes, pids })
      if (reason !== null) {
        lines.push(`keep     ${name(record.path)} (${reason})`)
        continue
      }
      const branch = record.branch === null ? '' : `; branch ${record.branch}`
      lines.push(`remove   ${name(record.path)} (merged, pushed, clean${branch})`)
      if (!options.apply) continue
      const removed = yield* git(main, ['worktree', 'remove', record.path])
      if (!removed.ok) {
        lines.push(`failed   ${name(record.path)}: ${removed.message}`)
        exit = 1
        continue
      }
      if (record.branch !== null) {
        const deleted = yield* git(main, ['branch', '-d', record.branch])
        if (!deleted.ok) lines.push(`note     branch ${record.branch} kept: ${deleted.message}`)
      }
    }

    for (const orphan of yield* orphans(main, records))
      lines.push(`orphan   ${name(orphan)} (not a worktree git knows; left for a person)`)
    if (!options.apply) lines.push('(report only: --apply to act)')
    return { exit, stdout: `${lines.join('\n')}\n`, stderr: '' }
  })
}

interface KeepContext {
  readonly here: string
  readonly base: string
  readonly processes: ProcessTable
  readonly pids: readonly number[] | null
}

/** Why the worktree stays, or null when it may go. The first reason found is the one reported. */
function keepReason(
  record: WorktreeRecord,
  context: KeepContext,
): Effect.Effect<string | null, never, ProcessRunner> {
  return Effect.gen(function* () {
    if (record.path === context.here) return 'this checkout'
    if (record.locked) return 'locked'
    if (context.processes.kind === 'unknown')
      return `cannot check for running processes: ${context.processes.reason}`
    if (context.pids !== null && context.pids.length > 0)
      return `running process: pid ${context.pids.join(', ')}`

    // --ignored adds `!! <path>` lines (a wholly ignored folder as one `dir/` line); plain status hides them.
    const status = yield* git(record.path, ['status', '--porcelain', '--ignored'])
    if (!status.ok) return `git status failed: ${status.message}`
    const entries = status.stdout.split('\n').filter((line) => line.trim() !== '')
    const uncommitted = entries.filter((line) => !line.startsWith('!! ')).length
    if (uncommitted > 0) return `${uncommitted} uncommitted`
    const precious = entries
      .filter((line) => line.startsWith('!! '))
      .map((line) => line.slice(3))
      .filter((path) => !isRegenerated(path))
    if (precious.length > 0) return `ignored files git would delete: ${precious.join(', ')}`

    const notInBase = yield* count(record.path, ['rev-list', '--count', `${context.base}..HEAD`])
    if (typeof notInBase === 'string') return notInBase
    if (notInBase > 0) return `${plural(notInBase, 'commit')} not in ${context.base}`

    // Merged into a local base can still mean nowhere but this machine: a commit must also be on a remote.
    const onNoRemote = yield* count(record.path, ['rev-list', '--count', 'HEAD', '--not', '--remotes'])
    if (typeof onNoRemote === 'string') return onNoRemote
    if (onNoRemote > 0) return `${plural(onNoRemote, 'commit')} on no remote`
    return null
  })
}

/** A `git rev-list --count` result, or the reason it could not be read. */
function count(dir: string, args: readonly string[]): Effect.Effect<number | string, never, ProcessRunner> {
  return git(dir, args).pipe(
    Effect.map((result) => {
      if (!result.ok) return `git ${args[0]} failed: ${result.message}`
      const value = Number(result.stdout.trim())
      return Number.isInteger(value) ? value : `git ${args[0]} printed ${JSON.stringify(result.stdout)}`
    }),
  )
}

/**
 * Folders directly under .claude/worktrees that git does not list (plan DT-D4: reported, never removed). `Files`
 * lists files only, so the folders come from `find`; a failing `find` reports none.
 */
function orphans(
  main: string,
  records: readonly WorktreeRecord[],
): Effect.Effect<string[], never, Files | ProcessRunner> {
  return Effect.gen(function* () {
    const dir = `${main}/${WORKTREES_DIR}`
    if (!(yield* (yield* Files).exists(dir))) return []
    const runner = yield* ProcessRunner
    const found = yield* runner
      .run('find', [dir, '-mindepth', '1', '-maxdepth', '1', '-type', 'd'])
      .pipe(Effect.either)
    if (found._tag === 'Left' || found.right.exitCode !== 0) return []
    const known = new Set(records.map((record) => record.path))
    return found.right.stdout
      .split('\n')
      .filter((path) => path !== '' && !known.has(path))
      .sort()
  })
}
