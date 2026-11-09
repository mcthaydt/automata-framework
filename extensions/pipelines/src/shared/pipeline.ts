import { Data, type Effect } from 'effect'
import type { z } from 'zod'
import type { FileError, Files, TaggedErrorClass } from './node/files.ts'
import type { ProcessError, ProcessRunner } from './node/process.ts'

/** A key of `pipeline.toml`'s `[budget]` table: `images`, `meshyCredits`, `visionCalls`. */
export type BudgetKey = string

/** What a stage sees: its target folder, the parsed spec, and the external task ids it recorded last time. */
export interface StageContext<Spec = unknown> {
  /** The target folder, absolute. Relative stage paths resolve against it. */
  readonly dir: string
  /** The spec file, absolute. */
  readonly specPath: string
  readonly spec: Spec
  /** The task ids this stage recorded on its last run (`restore` re-downloads from them); empty on a first run. */
  readonly tasks: Readonly<Record<string, string>>
}

/** What a finished stage records. */
export interface StageResult {
  readonly notes?: string
  /** External task ids (a paid provider's job ids), kept so `restore` brings the outputs back without paying. */
  readonly tasks?: Readonly<Record<string, string>>
}

const StageFailedBase: TaggedErrorClass<'StageFailed', { readonly stage: string; readonly reason: string }> =
  Data.TaggedError('StageFailed')
/** A stage's own failure: the provider's error, a bad output, a refused tool. */
export class StageFailed extends StageFailedBase {
  override get message(): string {
    return this.reason
  }
}

export type StageError = StageFailed | FileError | ProcessError

/** The services a stage runs on: build-time code reads and writes through `Files` and starts programs through `ProcessRunner`. */
export type StageServices = Files | ProcessRunner

/**
 * One step of a pipeline. Paths are relative to the target folder or absolute; a folder stands for every file below
 * it. The members are methods so that a `StageDef<Spec>` is also a `StageDef` (the router holds pipelines of every
 * spec type).
 */
export interface StageDef<Spec = unknown> {
  readonly id: string
  /** Paid stages only: the units of one budget key one run of the stage spends. */
  readonly cost?: { readonly budget: BudgetKey; readonly units: number }
  /** Stops the run after this stage until a person approves. */
  readonly gate?: string
  /** Hashed for the stage cache; a missing one makes the stage unrunnable. */
  inputs?(ctx: StageContext<Spec>): readonly string[]
  /** Must all exist for the stage to count as done. */
  outputs?(ctx: StageContext<Spec>): readonly string[]
  /** Outputs kept outside Git and brought back by `restore`: their absence never re-runs the stage. */
  restorable?(ctx: StageContext<Spec>): readonly string[]
  /** Hashed with the inputs (as canonical JSON): the spec values the stage depends on. */
  params?(ctx: StageContext<Spec>): unknown
  run(ctx: StageContext<Spec>): Effect.Effect<StageResult, StageError, StageServices>
  /** Brings the restorable outputs back from `ctx.tasks` without paying again. */
  restore?(ctx: StageContext<Spec>): Effect.Effect<void, StageError, StageServices>
}

/** One finding of `check`. */
export interface CheckResult {
  readonly id: string
  readonly ok: boolean
  readonly detail: string
}

export interface PipelineDef<Spec = unknown> {
  /** Lowercase words joined by `-`: `character`, `props`. */
  readonly name: string
  /** The schema of the spec file each target folder holds. */
  readonly spec: z.ZodType<Spec>
  /** The spec file's name inside a target folder; `<name>.toml` by default. */
  readonly specFile?: string
  /** In order. */
  readonly stages: readonly StageDef<Spec>[]
  /** The pipeline's own checks, run by `check` before the recorded outputs are checked. */
  check?(ctx: StageContext<Spec>): Effect.Effect<readonly CheckResult[], StageError, StageServices>
}

const PIPELINE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/** Checks a pipeline's shape once, where it is defined, and returns it unchanged. Throws on a mistake. */
export function definePipeline<Spec>(def: PipelineDef<Spec>): PipelineDef<Spec> {
  if (!PIPELINE_NAME.test(def.name))
    throw new Error(`'${def.name}' is not a pipeline name (lowercase words joined by '-')`)
  if (def.stages.length === 0) throw new Error(`${def.name}: no stages`)
  const ids = new Set<string>()
  const gates = new Map<string, string>()
  for (const stage of def.stages) {
    if (ids.has(stage.id)) throw new Error(`${def.name}: stage '${stage.id}' is defined twice`)
    ids.add(stage.id)
    if (stage.gate !== undefined) {
      const other = gates.get(stage.gate)
      if (other !== undefined)
        throw new Error(`${def.name}: gate '${stage.gate}' is on stages ${other} and ${stage.id}`)
      gates.set(stage.gate, stage.id)
    }
    const units = stage.cost?.units
    if (units !== undefined && !(Number.isInteger(units) && units > 0))
      throw new Error(
        `${def.name}: stage '${stage.id}' costs ${units} ${stage.cost?.budget}; a cost is a positive whole number of units`,
      )
  }
  return def
}
