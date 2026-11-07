/**
 * The commands that read a target's state or bring it in line with what is on disk: status, estimate, adopt, restore
 * and check. None of them runs a stage's work, except `restore`, which brings back files a finished stage can remake
 * without paying.
 */

import { Effect } from 'effect'
import { EXIT } from './exit.ts'
import type { Files } from './node/files.ts'
import type { CheckResult, StageServices } from './pipeline.ts'
import type { RunOptions } from './run-options.ts'
import { asStop, type Done, ok } from './run-outcome.ts'
import { blockingGate, openGate, plan, recordOf, selected } from './run-plan.ts'
import {
  contextOf,
  costOf,
  hashOf,
  isFinished,
  missingOf,
  now,
  pathsOf,
  type RunState,
  rel,
  type Stop,
  save,
  stop,
} from './run-state.ts'
import { missingPaths, resolveIn } from './stage-cache.ts'
import type { StageState } from './state.schema.ts'

export const status = (run: RunState): Effect.Effect<Done, Stop, Files> =>
  Effect.gen(function* () {
    const stale: string[] = []
    const needsRestore: string[] = []
    for (const stage of run.def.stages) {
      if (run.records[stage.id] === undefined) continue
      if (isFinished(run, stage) && run.records[stage.id]?.inputHash !== (yield* hashOf(run, stage)))
        stale.push(stage.id)
      if ((yield* missingOf(run, stage, 'restorable')).length > 0) needsRestore.push(stage.id)
    }
    return ok({ data: { stale, needsRestore } })
  })

export const estimate = (run: RunState, options: RunOptions): Effect.Effect<Done, Stop, Files> =>
  Effect.gen(function* () {
    const selection = yield* selected(run, options)
    const blocked = blockingGate(run, selection)
    const todo = blocked === undefined ? yield* plan(run, selection, options.force === true) : []
    const steps = todo.map(({ stage, digest }) => ({
      id: stage.id,
      inputHash: digest ?? 'missing',
      paid: stage.cost !== undefined,
      cost: costOf([stage]),
      ...(stage.gate === undefined ? {} : { gate: stage.gate }),
    }))
    const states = Object.fromEntries(todo.map(({ stage }): [string, StageState] => [stage.id, 'pending']))
    return ok({
      states,
      estimate: costOf(todo.map(({ stage }) => stage)),
      data: { plan: steps, blockedBy: blocked?.gate ?? null },
    })
  })

/** Marks stages whose outputs all exist as adopted, without running anything (no network, no spend). */
export const adopt = (run: RunState, options: RunOptions): Effect.Effect<Done, Stop, Files> =>
  Effect.gen(function* () {
    const states: Record<string, StageState> = {}
    const at = yield* now
    for (const stage of yield* selected(run, options)) {
      const produced = [...pathsOf(run, stage, 'outputs'), ...pathsOf(run, stage, 'restorable')]
      if (isFinished(run, stage) || produced.length === 0) continue
      if ((yield* missingPaths(run.dir, produced)).length > 0) continue
      run.records[stage.id] = recordOf(run, stage, 'adopted', yield* hashOf(run, stage), at)
      states[stage.id] = 'adopted'
      if (stage.gate !== undefined && run.gates[stage.gate] === undefined) openGate(run, stage, stage.gate)
    }
    yield* save(run)
    return ok({ states })
  })

/** Brings back each finished stage's missing restorable outputs from its recorded task ids, without paying. */
export const restore = (run: RunState): Effect.Effect<Done, Stop, StageServices> =>
  Effect.gen(function* () {
    if (!run.def.stages.some((stage) => stage.restore !== undefined))
      return yield* Effect.fail(stop(EXIT.notImplemented, `${run.def.name} has no restore`))
    const restored: string[] = []
    for (const stage of run.def.stages) {
      if (stage.restore === undefined || !isFinished(run, stage)) continue
      if ((yield* missingOf(run, stage, 'restorable')).length === 0) continue
      yield* Effect.mapError(stage.restore(contextOf(run, stage)), (error) =>
        stop(EXIT.failed, `${stage.id}: ${error.message}`),
      )
      restored.push(stage.id)
    }
    return ok({ data: { restored } })
  })

/** The pipeline's own checks, then every finished stage's recorded outputs (restorable ones live outside Git). */
export const check = (run: RunState): Effect.Effect<Done, Stop, StageServices> =>
  Effect.gen(function* () {
    const checks: CheckResult[] =
      run.def.check === undefined ? [] : [...(yield* Effect.mapError(run.def.check(contextOf(run)), asStop))]
    for (const stage of run.def.stages) {
      const record = run.records[stage.id]
      if (record === undefined || !isFinished(run, stage)) continue
      const exempt = new Set(pathsOf(run, stage, 'restorable'))
      const recorded = record.outputs
        .map((path) => resolveIn(run.dir, path))
        .filter((path) => !exempt.has(path))
      const missing = (yield* missingPaths(run.dir, recorded)).map((path) => rel(run, path))
      const detail = missing.length > 0 ? `missing ${missing.join(', ')}` : 'present'
      checks.push({ id: `outputs:${stage.id}`, ok: missing.length === 0, detail })
    }
    const failed = checks.filter((found) => !found.ok).map((found) => found.id)
    if (failed.length === 0) return ok({ data: { checks } })
    return { exit: EXIT.failed, parts: { data: { checks }, error: `failed: ${failed.join(', ')}` } }
  })

/** Every stage's declared paths, checked once (they must stay inside the target folder); a throw is a defect. */
export const checkPaths = (run: RunState): Effect.Effect<void> =>
  Effect.sync(() => {
    for (const stage of run.def.stages)
      for (const kind of ['inputs', 'outputs', 'restorable'] as const) pathsOf(run, stage, kind)
  })
