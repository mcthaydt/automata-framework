import { extname, join, resolve } from 'node:path'
import { Files } from '@mcthaydt/automata-node'
import { Clock, Effect } from 'effect'
import { parse } from 'smol-toml'
import type { z } from 'zod'
import type { Units } from './budget.ts'
import { EXIT, type PipelineExit } from './exit.ts'
import type { PipelineDef, StageContext, StageDef } from './pipeline.ts'
import { inputHash, missingPaths, relativeTo, resolveIn } from './stage-cache.ts'
import {
  type GateRecord,
  gateFileSchema,
  type PipelineResult,
  type StageRecord,
  type StageRow,
  type StageState,
  stageFileSchema,
} from './state.schema.ts'

// A target's state for one command: the parsed spec, `.stage.json` and `gates.json`, and the helpers every command
// shares (cache checks, rows, the result). The commands themselves are in runner.ts.

/** A command that cannot go on: the exit code and why. The runner turns it into the result. */
export interface Stop {
  readonly _tag: 'Stop'
  readonly exit: PipelineExit
  readonly error: string
  readonly estimate?: Units
  readonly states?: Readonly<Record<string, StageState>>
}

export const stop = (exit: PipelineExit, error: string, extra: Partial<Omit<Stop, '_tag'>> = {}): Stop => ({
  _tag: 'Stop',
  exit,
  error,
  ...extra,
})

export const STAGE_FILE = '.stage.json'
export const GATE_FILE = 'gates.json'

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

/** The current time as an ISO string, from Effect's Clock (TestClock in tests). */
export const now: Effect.Effect<string> = Effect.map(Clock.currentTimeMillis, (ms) =>
  new Date(ms).toISOString(),
)

/** The target as the spec file: a folder stands for the spec file it holds. */
export const resolveSpecPath = (def: PipelineDef, target: string): Effect.Effect<string, never, Files> =>
  Effect.gen(function* () {
    const files = yield* Files
    const path = resolve(target)
    const isFolder =
      (yield* files.exists(path)) && (yield* Effect.either(files.readText(path)))._tag === 'Left'
    return isFolder ? join(path, def.specFile ?? `${def.name}.toml`) : path
  })

/** Reads a JSON state file through its schema; an absent file is empty. */
const readState = <T>(path: string, schema: z.ZodType<T>, empty: T): Effect.Effect<T, Stop, Files> =>
  Effect.gen(function* () {
    const files = yield* Files
    if (!(yield* files.exists(path))) return empty
    const text = yield* Effect.mapError(files.readText(path), (error) => stop(EXIT.failed, error.message))
    const value = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: () => stop(EXIT.failed, `${path}: not JSON`),
    })
    const parsed = schema.safeParse(value)
    return parsed.success
      ? parsed.data
      : yield* Effect.fail(stop(EXIT.failed, `${path}: ${parsed.error.message}`))
  })

/** One command's view of a target. `records` and `gates` are mutated by the command and written by `save`. */
export interface RunState {
  readonly def: PipelineDef
  /** The target as the command was given it, for the result. */
  readonly target: string
  readonly dir: string
  readonly specPath: string
  readonly spec: unknown
  readonly records: Record<string, StageRecord>
  readonly gates: Record<string, GateRecord>
}

/** Parses the spec (exit 1 when it is missing or invalid) and reads the state files. */
export const loadRunState = (def: PipelineDef, target: string): Effect.Effect<RunState, Stop, Files> =>
  Effect.gen(function* () {
    const files = yield* Files
    const specPath = yield* resolveSpecPath(def, target)
    const dir = resolve(specPath, '..')
    const name = relativeTo(dir, specPath)
    const text = yield* Effect.mapError(files.readText(specPath), () =>
      stop(EXIT.failed, `${name}: not found`),
    )
    const raw = yield* Effect.try({
      try: () => (extname(specPath) === '.json' ? JSON.parse(text) : parse(text)) as unknown,
      catch: (cause) => stop(EXIT.failed, `${name}: ${messageOf(cause)}`),
    })
    const parsed = def.spec.safeParse(raw)
    if (!parsed.success)
      return yield* Effect.fail(
        stop(
          EXIT.failed,
          `${name}: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
        ),
      )
    const records = { ...(yield* readState(join(dir, STAGE_FILE), stageFileSchema, {})) }
    const gates = { ...(yield* readState(join(dir, GATE_FILE), gateFileSchema, {})) }
    return { def, target, dir, specPath, spec: parsed.data, records, gates }
  })

/** The context a stage's methods see. */
export const contextOf = (run: RunState, stage?: StageDef): StageContext => ({
  dir: run.dir,
  specPath: run.specPath,
  spec: run.spec,
  tasks: (stage === undefined ? undefined : run.records[stage.id]?.tasks) ?? {},
})

/** A stage path list, absolute. */
export const pathsOf = (
  run: RunState,
  stage: StageDef,
  kind: 'inputs' | 'outputs' | 'restorable',
): readonly string[] => (stage[kind]?.(contextOf(run, stage)) ?? []).map((path) => resolveIn(run.dir, path))

export const rel = (run: RunState, path: string): string => relativeTo(run.dir, path)

export const hashOf = (run: RunState, stage: StageDef): Effect.Effect<string | null, Stop, Files> =>
  Effect.mapError(inputHash(stage, contextOf(run, stage)), (error) => stop(EXIT.failed, error.message))

/** The paths of `kind` with no file, from the target folder. */
export const missingOf = (
  run: RunState,
  stage: StageDef,
  kind: 'inputs' | 'outputs' | 'restorable',
): Effect.Effect<string[], never, Files> =>
  Effect.map(missingPaths(run.dir, pathsOf(run, stage, kind)), (paths) => paths.map((path) => rel(run, path)))

const finished = (record: StageRecord | undefined): boolean =>
  record?.state === 'done' || record?.state === 'adopted'

export const isFinished = (run: RunState, stage: StageDef): boolean => finished(run.records[stage.id])

/** Done or adopted, with the same input hash and every (non-restorable) output present: the cache may skip it. */
export const isCurrent = (
  run: RunState,
  stage: StageDef,
  digest: string | null,
): Effect.Effect<boolean, never, Files> =>
  Effect.gen(function* () {
    const record = run.records[stage.id]
    if (!finished(record) || digest === null || record?.inputHash !== digest) return false
    return (yield* missingOf(run, stage, 'outputs')).length === 0
  })

export const decision = (run: RunState, gate: string): GateRecord['decision'] | undefined =>
  run.gates[gate]?.decision

/** Every gate holds until a person approves it (plan D1). */
export const holds = (run: RunState, stage: StageDef): boolean =>
  stage.gate !== undefined && decision(run, stage.gate) !== 'approved'

/** The units a list of stages costs, per budget key. */
export const costOf = (stages: readonly StageDef[]): Units => {
  const total: Record<string, number> = {}
  for (const stage of stages)
    if (stage.cost !== undefined)
      total[stage.cost.budget] = (total[stage.cost.budget] ?? 0) + stage.cost.units
  return total
}

const spentOf = (run: RunState | undefined): Units => {
  const total: Record<string, number> = {}
  for (const record of Object.values(run?.records ?? {}))
    for (const [key, units] of Object.entries(record.cost ?? {})) total[key] = (total[key] ?? 0) + units
  return total
}

const rowsOf = (
  def: PipelineDef,
  run: RunState | undefined,
  states: Readonly<Record<string, StageState>>,
): StageRow[] =>
  def.stages.map((stage) => {
    const record = run?.records[stage.id]
    return {
      id: stage.id,
      state: states[stage.id] ?? record?.state ?? 'pending',
      ...(stage.cost === undefined ? {} : { paid: true as const }),
      ...(stage.gate === undefined ? {} : { gate: stage.gate }),
      ...(record?.cost === undefined ? {} : { cost: record.cost }),
    }
  })

export interface ResultParts {
  readonly states?: Readonly<Record<string, StageState>> | undefined
  readonly gates?: readonly GateRecord[] | undefined
  readonly estimate?: Units | undefined
  readonly error?: string | undefined
  readonly data?: unknown
}

/** The command's result; `run` is undefined when the spec could not be read. */
export function resultOf(
  def: PipelineDef,
  run: RunState | undefined,
  command: string,
  target: string,
  exit: PipelineExit,
  parts: ResultParts = {},
): PipelineResult {
  return {
    ok: exit === EXIT.done || exit === EXIT.atGate,
    pipeline: def.name,
    command,
    target,
    exit,
    stages: rowsOf(def, run, parts.states ?? {}),
    gates: parts.gates ?? Object.values(run?.gates ?? {}),
    spent: spentOf(run),
    ...(parts.estimate === undefined ? {} : { estimate: parts.estimate }),
    ...(parts.error === undefined ? {} : { error: parts.error }),
    ...(parts.data === undefined ? {} : { data: parts.data }),
  }
}

/** Writes `.stage.json`, and `gates.json` once there is a gate. */
export const save = (run: RunState): Effect.Effect<void, Stop, Files> =>
  Effect.gen(function* () {
    const files = yield* Files
    const write = (name: string, value: unknown) =>
      Effect.mapError(files.writeText(join(run.dir, name), `${JSON.stringify(value, null, 2)}\n`), (error) =>
        stop(EXIT.failed, error.message),
      )
    yield* write(STAGE_FILE, run.records)
    if (Object.keys(run.gates).length > 0) yield* write(GATE_FILE, run.gates)
  })
