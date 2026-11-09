/**
 * The `run` command: the budget checks before anything runs, then each planned stage in order. A paid stage is charged
 * under the spend ledger's lock, a gated stage stops the run, and a stage that throws is a failed stage, not a crash.
 */

import { Effect, type Scope } from 'effect'
import { budgetRefusal } from './budget.ts'
import { EXIT } from './exit.ts'
import type { Files } from './node/files.ts'
import type { StageDef, StageServices } from './pipeline.ts'
import { charge, holdLedger, loadProject, type Project, readSpent } from './project.ts'
import type { RunOptions } from './run-options.ts'
import { asStop, type Done, messageOf, ok } from './run-outcome.ts'
import { blockingGate, openGate, plan, recordOf, selected } from './run-plan.ts'
import {
  contextOf,
  costOf,
  decision,
  hashOf,
  holds,
  isCurrent,
  missingOf,
  now,
  pathsOf,
  type RunState,
  rel,
  type Stop,
  save,
  stop,
} from './run-state.ts'
import { missingPaths, StageThrew } from './stage-cache.ts'
import type { StageState } from './state.schema.ts'

/**
 * Refuses a run whose paid stages lack --paid or pass a budget, before any stage runs. A run with paid stages holds
 * the spend ledger from here until the run's scope closes, so two runs cannot both spend what is left.
 */
const checkBudgets = (
  run: RunState,
  options: RunOptions,
  paid: readonly StageDef[],
): Effect.Effect<Project, Stop, Files | Scope.Scope> =>
  Effect.gen(function* () {
    if (paid.length > 0 && options.paid !== true)
      return yield* Effect.fail(
        stop(EXIT.refused, `paid stages need --paid: ${paid.map((stage) => stage.id).join(', ')}`),
      )
    const project = yield* Effect.mapError(loadProject(run.dir, options.config), asStop)
    if (paid.length === 0) return project
    // Without a pipeline.toml there is no budget and no ledger: the check below refuses.
    if (project.path !== undefined)
      yield* Effect.mapError(holdLedger(project), (error) => stop(EXIT.refused, error))
    const need = costOf(paid)
    const spent = yield* Effect.mapError(readSpent(project), asStop)
    const refusal = budgetRefusal(need, project.toml, spent, options.budget)
    if (refusal !== undefined) return yield* Effect.fail(stop(EXIT.refused, refusal, { estimate: need }))
    return project
  })

export const runStages = (run: RunState, options: RunOptions): Effect.Effect<Done, Stop, StageServices> =>
  Effect.scoped(runHeld(run, options))

const runHeld = (
  run: RunState,
  options: RunOptions,
): Effect.Effect<Done, Stop, StageServices | Scope.Scope> =>
  Effect.gen(function* () {
    const selection = yield* selected(run, options)
    const blocked = blockingGate(run, selection)
    if (blocked?.gate !== undefined)
      return yield* Effect.fail(
        stop(
          EXIT.atGate,
          `gate ${blocked.gate} (stage ${blocked.id}) is ${decision(run, blocked.gate) ?? 'not requested'}; ` +
            `a person approves it with \`automata-pipe ${run.def.name} approve ${run.target} ${blocked.gate}\``,
        ),
      )
    const todo = yield* plan(run, selection, options.force === true)
    const project = yield* checkBudgets(
      run,
      options,
      todo.filter(({ stage }) => stage.cost !== undefined).map(({ stage }) => stage),
    )
    // Under the ledger lock (when anything is paid): the stages must be the ones the estimate token covered.
    const estimated = options.plan
    if (estimated !== undefined) {
      const willRun = todo.map(({ stage }) => stage.id)
      const covered = estimated.map((row) => row.id)
      if (willRun.join('\n') !== covered.join('\n'))
        return yield* Effect.fail(
          stop(
            EXIT.refused,
            `the plan changed since the estimate: it would run ${willRun.join(', ') || 'nothing'}; ` +
              `the estimate covered ${covered.join(', ') || 'nothing'}; estimate again`,
          ),
        )
    }

    const planned = new Set(todo.map(({ stage }) => stage.id))
    const states: Record<string, StageState> = {}
    for (const stage of selection) {
      const current = !planned.has(stage.id) && (yield* isCurrent(run, stage, yield* hashOf(run, stage)))
      states[stage.id] = current ? 'skipped' : 'pending'
    }
    const restorable = new Set(run.def.stages.flatMap((stage) => pathsOf(run, stage, 'restorable')))
    const fail = (stage: StageDef, digest: string | null, why: string, at: string) =>
      Effect.gen(function* () {
        run.records[stage.id] = {
          id: stage.id,
          state: 'failed',
          inputHash: digest ?? 'missing',
          outputs: [],
          at,
          notes: why.slice(0, 500),
        }
        yield* save(run)
        states[stage.id] = 'failed'
        return yield* Effect.fail(stop(EXIT.failed, `${stage.id}: ${why}`, { states }))
      })

    for (const { stage } of todo) {
      const inputs = pathsOf(run, stage, 'inputs')
      const missing = yield* missingPaths(run.dir, inputs)
      if (missing.length > 0) {
        states[stage.id] = 'failed'
        const hint = missing.some((path) => restorable.has(path)) ? ' (run `restore` first)' : ''
        const names = missing.map((path) => rel(run, path)).join(', ')
        return yield* Effect.fail(
          stop(EXIT.failed, `${stage.id}: missing inputs ${names}${hint}`, { states }),
        )
      }
      // Hashed again: an earlier stage of this run may have rewritten the inputs.
      const digest = yield* hashOf(run, stage)
      if (stage.cost !== undefined) {
        // The estimate hashed these inputs, unless they were still to be made by an earlier stage of this run
        // (`missing`): those stages ran in this same plan, which was checked above.
        const promised = estimated?.find((row) => row.id === stage.id)?.inputHash
        if (promised !== undefined && promised !== 'missing' && promised !== digest)
          return yield* Effect.fail(
            stop(EXIT.refused, `${stage.id}: its inputs changed since the estimate; estimate again`, {
              states,
            }),
          )
        // Checked again under the ledger lock, right before the charge.
        const { budget, units } = stage.cost
        const spent = yield* Effect.mapError(readSpent(project), asStop)
        const refusal = budgetRefusal({ [budget]: units }, project.toml, spent, options.budget)
        if (refusal !== undefined) return yield* Effect.fail(stop(EXIT.refused, refusal, { states }))
        yield* Effect.mapError(charge(project, budget, units), asStop)
      }
      // A throw in the stage (in `run` itself, inside its effect, or in `outputs`) is a failed stage, not a crash.
      const attempt = Effect.suspend(() => stage.run(contextOf(run, stage))).pipe(
        Effect.mapError((error) => error.message),
        Effect.flatMap((result) =>
          Effect.map(missingOf(run, stage, 'outputs'), (unwritten) => ({ result, unwritten })),
        ),
        Effect.catchAllDefect((defect) =>
          Effect.fail(defect instanceof StageThrew ? defect.reason : messageOf(defect)),
        ),
      )
      const outcome = yield* Effect.either(attempt)
      const at = yield* now
      if (outcome._tag === 'Left') return yield* fail(stage, digest, outcome.left, at)
      const { result, unwritten } = outcome.right
      if (unwritten.length > 0)
        return yield* fail(stage, digest, `did not write its outputs: ${unwritten.join(', ')}`, at)
      run.records[stage.id] = {
        ...recordOf(run, stage, 'done', digest, at),
        ...(stage.cost === undefined ? {} : { cost: costOf([stage]) }),
        ...(result.notes === undefined ? {} : { notes: result.notes }),
        ...(result.tasks === undefined ? {} : { tasks: { ...result.tasks } }),
      }
      states[stage.id] = 'done'
      if (stage.gate !== undefined) openGate(run, stage, stage.gate)
      yield* save(run)
      if (stage.gate !== undefined) {
        states[stage.id] = 'gated'
        return { exit: EXIT.atGate, parts: { states } }
      }
    }
    // A skipped gated stage that is not approved stops the run there (the plan stopped at it).
    for (const stage of selection) {
      if (stage.gate === undefined || planned.has(stage.id) || !holds(run, stage)) continue
      states[stage.id] = 'gated'
      const why = `gate ${stage.gate} is ${decision(run, stage.gate) ?? 'not requested'}`
      return { exit: EXIT.atGate, parts: { states, error: why } }
    }
    return ok({ states })
  })
