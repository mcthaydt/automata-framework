/**
 * The commands a person's decision about a gate goes through: approve, reject and request. They only record; a rejected
 * gate's stage runs again on the next `run`.
 */

import { Effect } from 'effect'
import { EXIT } from './exit.ts'
import type { Files } from './node/files.ts'
import type { RunOptions } from './run-options.ts'
import { type Done, ok } from './run-outcome.ts'
import { now, type RunState, type Stop, save, stop } from './run-state.ts'
import type { GateRecord } from './state.schema.ts'

export const gateFor = (run: RunState, options: RunOptions): Effect.Effect<GateRecord, Stop> => {
  if (options.gate === undefined) return Effect.fail(stop(EXIT.failed, `${options.command} needs a gate`))
  const record = run.gates[options.gate]
  return record === undefined
    ? Effect.fail(stop(EXIT.failed, `no gate '${options.gate}' for this target`))
    : Effect.succeed(record)
}

/** approve / reject: a person's decision. Only records: a rejected gate's stage runs again on the next `run`. */
export const decide = (
  run: RunState,
  options: RunOptions,
  verdict: 'approved' | 'rejected',
): Effect.Effect<Done, Stop, Files> =>
  Effect.gen(function* () {
    const record = yield* gateFor(run, options)
    const asked = options.expect
    if (asked !== undefined) {
      const stage = run.records[record.stage]
      const same =
        record.decision === 'pending' &&
        record.requestedAt === asked.requestedAt &&
        stage?.inputHash === asked.inputHash &&
        stage?.at === asked.at
      if (!same)
        return yield* Effect.fail(
          stop(EXIT.refused, `gate ${record.id} changed while it was asked; ask again`),
        )
    }
    const decided: GateRecord = {
      ...record,
      decision: verdict,
      decidedAt: yield* now,
      by: 'owner',
      ...(options.note === undefined ? {} : { note: options.note }),
    }
    run.gates[record.id] = decided
    yield* save(run)
    return ok({ gates: [decided] })
  })

/** Marks a pending gate as put to a person, with `--note` as the summary. Decides nothing. */
export const request = (run: RunState, options: RunOptions): Effect.Effect<Done, Stop, Files> =>
  Effect.gen(function* () {
    const record = yield* gateFor(run, options)
    const requested: GateRecord = {
      ...record,
      requestedAt: yield* now,
      ...(options.note === undefined ? {} : { summary: options.note }),
    }
    run.gates[record.id] = requested
    yield* save(run)
    // What the person is asked about: a decision passes it back as `expect` (RunOptions).
    const stage = run.records[record.stage]
    return ok({
      gates: [requested],
      ...(stage === undefined ? {} : { data: { stage: { inputHash: stage.inputHash, at: stage.at } } }),
    })
  })
