import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Effect, type Scope } from 'effect'
import { parse } from 'smol-toml'
import type { Units } from './budget.ts'
import { type FileError, Files } from './node-seams.ts'
import { type PipelineToml, pipelineTomlSchema } from './pipeline-toml.schema.ts'
import { spendLedgerSchema } from './state.schema.ts'

// The project a target belongs to: the nearest `pipeline.toml` at or above the target folder (or `--config`), its
// budgets, and the spend ledger beside it.

export const PIPELINE_TOML = 'pipeline.toml'
export const SPEND_LEDGER = 'pipeline-spend.json'
export const SPEND_LOCK = 'pipeline-spend.lock'

/** A project with no `pipeline.toml`: no budgets, so every paid stage is refused. */
export const NO_PROJECT: PipelineToml = { budget: {}, generated: [], locked: {} }

export interface Project {
  /** The `pipeline.toml` read, if any. */
  readonly path: string | undefined
  readonly toml: PipelineToml
}

/** The nearest `pipeline.toml` at or above `dir`, or `undefined`. */
export const findPipelineToml = (dir: string): Effect.Effect<string | undefined, never, Files> =>
  Effect.gen(function* () {
    const files = yield* Files
    for (let at = resolve(dir); ; at = dirname(at)) {
      const candidate = join(at, PIPELINE_TOML)
      if (yield* files.exists(candidate)) return candidate
      if (dirname(at) === at) return undefined
    }
  })

/** Reads and validates a `pipeline.toml`; the error names the file and each problem. */
export const loadProject = (dir: string, config?: string): Effect.Effect<Project, string, Files> =>
  Effect.gen(function* () {
    const path = config === undefined ? yield* findPipelineToml(dir) : resolve(config)
    if (path === undefined) return { path, toml: NO_PROJECT }
    const text = yield* Effect.mapError((yield* Files).readText(path), (error) => error.message)
    const parsed = yield* Effect.try({
      try: () => pipelineTomlSchema.safeParse(parse(text)),
      catch: (cause) => `${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
    })
    if (!parsed.success)
      return yield* Effect.fail(
        `${path}: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
      )
    return { path, toml: parsed.data }
  })

const ledgerPath = (project: Project): string | undefined =>
  project.path === undefined ? undefined : join(dirname(project.path), SPEND_LEDGER)

/** The units charged so far across the project; empty without a ledger. */
export const readSpent = (project: Project): Effect.Effect<Units, FileError | string, Files> =>
  Effect.gen(function* () {
    const path = ledgerPath(project)
    const files = yield* Files
    if (path === undefined || !(yield* files.exists(path))) return {}
    const text = yield* files.readText(path)
    const parsed = spendLedgerSchema.safeParse(
      yield* Effect.try({ try: () => JSON.parse(text), catch: () => `${path}: not JSON` }),
    )
    if (!parsed.success) return yield* Effect.fail(`${path}: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
    return parsed.data
  })

/** Whether the process whose pid `lock` holds has ended (`process.kill(pid, 0)` throws ESRCH). */
function holderIsGone(lock: string): boolean {
  let pid: number
  try {
    pid = Number.parseInt(readFileSync(lock, 'utf8'), 10)
  } catch {
    return false
  }
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return false
  } catch (cause) {
    // EPERM: the process exists but belongs to someone else, so it is alive.
    return (cause as { code?: unknown }).code === 'ESRCH'
  }
}

/**
 * Creates `lock` exclusively, holding this process's pid. A lock whose pid has ended (a Ctrl-C before the bins
 * handled signals, a killed server, a crash) is removed and taken over once (M3.8b review round 3). Two processes
 * taking over the same dead lock in the same instant could both remove it; that needs a crash and a race together,
 * and the bins now release their locks on SIGINT and SIGTERM (main.ts), so it is accepted rather than engineered for.
 */
function tryLock(lock: string): 'held' | 'busy' | 'no folder' {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lock, `${process.pid}\n`, { flag: 'wx' })
      return 'held'
    } catch (cause) {
      const code = (cause as { code?: unknown }).code
      if (code === 'ENOENT') return 'no folder'
      if (code !== 'EEXIST') throw cause
      if (attempt > 0 || !holderIsGone(lock)) return 'busy'
      rmSync(lock, { force: true })
    }
  }
  return 'busy'
}

/**
 * Holds `lock` for the scope, or fails with `busy` (never waits). Removed when the scope closes, interrupted or not.
 * A missing folder holds nothing: `optional` says whether that is fine (a target folder) or an error.
 */
const holdLock = (lock: string, busy: string, optional: boolean): Effect.Effect<void, string, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.try({
      try: () => tryLock(lock),
      catch: (cause) => `${lock}: ${cause instanceof Error ? cause.message : String(cause)}`,
    }).pipe(
      Effect.flatMap((state) => {
        if (state === 'busy') return Effect.fail(busy)
        if (state === 'no folder' && !optional) return Effect.fail(`${lock}: its folder does not exist`)
        return Effect.succeed(state === 'held')
      }),
    ),
    (held) => (held ? Effect.sync(() => rmSync(lock, { force: true })) : Effect.void),
  ).pipe(Effect.asVoid)

/**
 * Holds the ledger for the paid part of one run: `pipeline-spend.lock` beside it, created exclusively, removed when
 * the scope closes (so a failure cannot leak it). A run that finds it held by a live process fails at once, naming the
 * lock; it never waits. `Files` has no exclusive create and no rename, so the lock and the ledger's atomic write use
 * `node:fs` directly (plan, review round 1).
 */
export const holdLedger = (project: Project): Effect.Effect<void, string, Scope.Scope> => {
  const path = ledgerPath(project)
  if (path === undefined) return Effect.fail(`no ${PIPELINE_TOML}: nothing paid may run`)
  const lock = join(dirname(path), SPEND_LOCK)
  return holdLock(
    lock,
    `the spend ledger is locked by another run: ${lock} (delete it if no run is going)`,
    false,
  )
}

/** The lock one command that changes a target holds on it, in the target folder beside `.stage.json`. */
export const TARGET_LOCK = '.pipeline.lock'

/**
 * Holds a target for one command that changes it (run, approve, reject, request, adopt, restore), from before its
 * state is read until after it is written, so no command saves over another's (M3.8b review: a long run's save would
 * otherwise overwrite a decision made while it ran). A command that finds it held by a live process fails at once
 * with exit 4, never waits. A folder that does not exist is not locked: reading it fails on its own.
 */
export const holdTarget = (dir: string): Effect.Effect<void, string, Scope.Scope> => {
  const lock = join(dir, TARGET_LOCK)
  return holdLock(
    lock,
    `the target is busy with another command: ${lock} (delete it if no command is going)`,
    true,
  )
}

/**
 * Adds `units` of `key` to the ledger, written to a temporary file and renamed into place so a reader never sees half
 * a ledger. Call it only while holding the ledger. The runner charges a paid stage before it runs, so a call the
 * provider charged for counts even when the stage then fails (plan D2).
 */
export const charge = (
  project: Project,
  key: string,
  units: number,
): Effect.Effect<void, FileError | string, Files> =>
  Effect.gen(function* () {
    const path = ledgerPath(project)
    if (path === undefined) return yield* Effect.fail(`no ${PIPELINE_TOML}: nothing paid may run`)
    const spent = { ...(yield* readSpent(project)) }
    spent[key] = (spent[key] ?? 0) + units
    const sorted = Object.fromEntries(Object.entries(spent).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    const temp = `${path}.${process.pid}.tmp`
    yield* (yield* Files).writeText(temp, `${JSON.stringify(sorted, null, 2)}\n`)
    yield* Effect.try({
      try: () => renameSync(temp, path),
      catch: (cause) => `${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
    })
  })
