/**
 * What a run would do: which stages the options select, which of them a pending gate blocks, which would execute, and
 * the records a stage leaves behind.
 */

import { Effect } from 'effect'
import { EXIT } from './exit.ts'
import type { Files } from './node/files.ts'
import type { StageDef } from './pipeline.ts'
import type { RunOptions } from './run-options.ts'
import {
  decision,
  hashOf,
  holds,
  isCurrent,
  pathsOf,
  type RunState,
  rel,
  type Stop,
  stop,
} from './run-state.ts'
import type { StageRecord } from './state.schema.ts'

export interface Step {
  readonly stage: StageDef
  readonly digest: string | null
}

/** The selection: `--only`, or `--from` to `--to`, in pipeline order. */
export const selected = (run: RunState, options: RunOptions): Effect.Effect<readonly StageDef[], Stop> => {
  const stages = run.def.stages
  const ids = stages.map((stage) => stage.id)
  for (const id of [...(options.only ?? []), options.from, options.to])
    if (id !== undefined && !ids.includes(id))
      return Effect.fail(stop(EXIT.failed, `unknown stage '${id}'; stages: ${ids.join(', ')}`))
  if (options.only !== undefined && options.only.length > 0)
    return Effect.succeed(stages.filter((stage) => options.only?.includes(stage.id)))
  const start = options.from === undefined ? 0 : ids.indexOf(options.from)
  const end = options.to === undefined ? ids.length - 1 : ids.indexOf(options.to)
  return Effect.succeed(stages.slice(start, end + 1))
}

/**
 * A gated stage that is not approved, not selected, and before the last selected stage blocks the selection: with
 * --from it is before the first one, and with --only it can sit between two selected stages. Nothing runs past a
 * pending gate. (A selected gated stage is the plan's: it may run again, and the plan stops at it.)
 */
export const blockingGate = (run: RunState, selection: readonly StageDef[]): StageDef | undefined => {
  const last = selection.at(-1)
  const end = last === undefined ? 0 : run.def.stages.indexOf(last)
  return run.def.stages.slice(0, end).find((stage) => !selection.includes(stage) && holds(run, stage))
}

/**
 * The stages a run would execute, conservatively: once one runs, every later one does too. Stops after a gated stage
 * that runs (its gate opens) and at a gated stage that is not approved.
 */
export const plan = (
  run: RunState,
  selection: readonly StageDef[],
  force: boolean,
): Effect.Effect<Step[], Stop, Files> =>
  Effect.gen(function* () {
    const todo: Step[] = []
    let cascade = false
    for (const stage of selection) {
      const digest = yield* hashOf(run, stage)
      const rejected = stage.gate !== undefined && decision(run, stage.gate) === 'rejected'
      if (force || cascade || rejected || !(yield* isCurrent(run, stage, digest))) {
        todo.push({ stage, digest })
        cascade = true
        if (stage.gate !== undefined) break
      } else if (holds(run, stage)) break
    }
    return todo
  })

export const producedBy = (run: RunState, stage: StageDef): string[] =>
  [...pathsOf(run, stage, 'outputs'), ...pathsOf(run, stage, 'restorable')].map((path) => rel(run, path))

/** Opens the stage's gate as pending; what to look at is what the stage made. */
export const openGate = (run: RunState, stage: StageDef, gate: string): void => {
  run.gates[gate] = { id: gate, stage: stage.id, decision: 'pending', files: producedBy(run, stage) }
}

export const recordOf = (
  run: RunState,
  stage: StageDef,
  state: 'done' | 'adopted',
  digest: string | null,
  at: string,
): StageRecord => ({
  id: stage.id,
  state,
  inputHash: digest ?? 'missing',
  outputs: producedBy(run, stage),
  at,
})
