import { dirname, join, resolve } from 'node:path'
import { type FileError, Files } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import type { Units } from './budget.ts'
import { type PipelineToml, pipelineTomlSchema } from './pipeline-toml.schema.ts'
import { spendLedgerSchema } from './state.schema.ts'

// The project a target belongs to: the nearest `pipeline.toml` at or above the target folder (or `--config`), its
// budgets, and the spend ledger beside it.

export const PIPELINE_TOML = 'pipeline.toml'
export const SPEND_LEDGER = 'pipeline-spend.json'

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

/**
 * Adds `units` of `key` to the ledger. The runner charges a paid stage before it runs, so a call the provider
 * charged for counts even when the stage then fails (plan D2).
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
    yield* (yield* Files).writeText(path, `${JSON.stringify(sorted, null, 2)}\n`)
  })
