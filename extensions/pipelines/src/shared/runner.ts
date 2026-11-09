import { dirname } from 'node:path'
import { Cause, Effect, Exit, Option } from 'effect'
import { EXIT } from './exit.ts'
import { decide, request } from './gate-commands.ts'
import type { PipelineDef, StageServices } from './pipeline.ts'
import { holdTarget } from './project.ts'
import type { Command, RunOptions } from './run-options.ts'
import { type Done, messageOf } from './run-outcome.ts'
import { runStages } from './run-stages.ts'
import {
  loadRunState,
  now,
  type RunState,
  resolveSpecPath,
  resultOf,
  type Stop,
  save,
  stop,
} from './run-state.ts'
import { StageThrew } from './stage-cache.ts'
import type { PipelineResult } from './state.schema.ts'
import { adopt, check, checkPaths, estimate, restore, status } from './state-commands.ts'

// The stage runner, on Effect: it loads a target's state, runs one command on it and turns the outcome into a result.
// Files are the state: `.stage.json` and `gates.json` in the target folder. A stage is skipped when its input hash is
// unchanged and its outputs exist; once one runs, every later one does. A gate stops the run (exit 3) until a person
// approves it. Paid stages need --paid and must fit the run and project budgets, checked before anything runs (exit 4).
// The commands are in `run-stages.ts` (run), `gate-commands.ts` (approve, reject, request) and `state-commands.ts` (the
// rest); `run-plan.ts` is what a run would do.

export { COMMANDS, type Command, type RunOptions } from './run-options.ts'

const execute = (state: RunState, options: RunOptions): Effect.Effect<Done, Stop, StageServices> => {
  const recordsOnly = ['approve', 'reject', 'request'].includes(options.command)
  return recordsOnly ? dispatch(state, options) : Effect.zipRight(checkPaths(state), dispatch(state, options))
}

const dispatch = (state: RunState, options: RunOptions): Effect.Effect<Done, Stop, StageServices> => {
  switch (options.command) {
    case 'status':
      return status(state)
    case 'estimate':
      return estimate(state, options)
    case 'run':
      return runStages(state, options)
    case 'approve':
      return decide(state, options, 'approved')
    case 'reject':
      return decide(state, options, 'rejected')
    case 'request':
      return request(state, options)
    case 'adopt':
      return adopt(state, options)
    case 'restore':
      return restore(state)
    case 'check':
      return check(state)
  }
}

/** The commands that write a target's state, and so hold its lock (project.ts `holdTarget`). */
const CHANGES_TARGET: ReadonlySet<Command> = new Set([
  'run',
  'approve',
  'reject',
  'request',
  'adopt',
  'restore',
])

/** Runs one command on one target and returns its result. It never fails: every problem is an exit code. */
export const runPipeline = (
  def: PipelineDef,
  options: RunOptions,
): Effect.Effect<PipelineResult, never, StageServices> => {
  if (!CHANGES_TARGET.has(options.command)) return runUnlocked(def, options)
  return Effect.scoped(
    Effect.gen(function* () {
      const specPath = yield* resolveSpecPath(def, options.target)
      const held = yield* Effect.either(holdTarget(dirname(specPath)))
      if (held._tag === 'Left')
        return resultOf(def, undefined, options.command, options.target, EXIT.refused, { error: held.left })
      return yield* runUnlocked(def, options)
    }),
  )
}

const runUnlocked = (
  def: PipelineDef,
  options: RunOptions,
): Effect.Effect<PipelineResult, never, StageServices> =>
  Effect.gen(function* () {
    const { command, target } = options
    const loaded = yield* Effect.either(
      Effect.catchAllDefect(loadRunState(def, target), (defect) =>
        Effect.fail(stop(EXIT.failed, messageOf(defect))),
      ),
    )
    if (loaded._tag === 'Left')
      return resultOf(def, undefined, command, target, loaded.left.exit, { error: loaded.left.error })
    const state = loaded.right
    const outcome = yield* Effect.exit(execute(state, options))
    if (Exit.isSuccess(outcome))
      return resultOf(def, state, command, target, outcome.value.exit, outcome.value.parts)
    const failure = Cause.failureOption(outcome.cause)
    if (Option.isSome(failure)) {
      const { exit, error, estimate: need, states } = failure.value
      return resultOf(def, state, command, target, exit, { error, estimate: need, states })
    }
    // A defect: a stage method threw outside its run (paths, params), or a bug. Exit 1, never a crash; a stage that
    // threw during `run` is recorded as failed.
    const defect = Cause.squash(outcome.cause)
    if (defect instanceof StageThrew && command === 'run') {
      state.records[defect.stage] = {
        id: defect.stage,
        state: 'failed',
        inputHash: 'missing',
        outputs: [],
        at: yield* now,
        notes: defect.reason.slice(0, 500),
      }
      yield* Effect.either(save(state))
      const states = { [defect.stage]: 'failed' as const }
      return resultOf(def, state, command, target, EXIT.failed, { error: defect.message, states })
    }
    return resultOf(def, state, command, target, EXIT.failed, { error: messageOf(defect) })
  })
