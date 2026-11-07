// Records a run as a Replay while stepping it. Nothing else may step the sim while it
// records; the recorder notices when something did and refuses to continue, since the replay would be wrong.

import { canonicalJson } from '../../shared/hash/canonical'
import { hex64, xxhash64 } from '../../shared/hash/xxhash64'
import { sortedKeys } from '../../shared/util/sorted'
import { SIM_VERSION } from '../../shared/version'
import type { Command, Sim, StepResult } from '../../shared/world/sim'
import { ReplayRecordError } from './errors'
import { DEFAULT_CHECK_EVERY, type Replay, type ReplayCommand } from './replay'

/**
 * What a recording takes: how often to store a check hash, whether to keep a reference hash and snapshots
 * (goldens), and free-form `meta`.
 */
export interface RecorderOptions {
  /** A check hash every this many ticks from the start (default 60, at least 1). */
  readonly checkEvery?: number
  /** Goldens: also a hash after every step and a full snapshot every `snapshotEvery` ticks. */
  readonly reference?: { readonly snapshotEvery: number }
  readonly meta?: Readonly<Record<string, string>>
}

/**
 * Steps a sim and records the run as a `Replay`. Nothing else may step the sim while it records; the recorder
 * refuses to continue if something did.
 */
export interface Recorder {
  /** `sim.step` plus recording. */
  step(commands: readonly Command[]): StepResult
  /** Adds the final tick and hash; the recorder is closed afterwards. */
  finish(): Replay
}

/**
 * Plain data with every `undefined`-valued object key removed, as JSON.stringify would drop it, so a payload
 * with an explicit undefined optional field still records. Anything else canonical JSON refuses stays put.
 */
function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined)
  if (typeof value !== 'object' || value === null) return value
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return value
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of sortedKeys(obj)) if (obj[key] !== undefined) out[key] = withoutUndefined(obj[key])
  return out
}

const isCount = (n: number): boolean => Number.isInteger(n) && n >= 1

/**
 * Starts recording `sim` from its current state, for the recorder's `step` to extend. Throws
 * `ReplayRecordError` for a `checkEvery` or `snapshotEvery` that is not an integer of at least 1.
 */
export function createRecorder(sim: Sim, options: RecorderOptions = {}): Recorder {
  const checkEvery = options.checkEvery ?? DEFAULT_CHECK_EVERY
  if (!isCount(checkEvery))
    throw new ReplayRecordError(`checkEvery must be an integer >= 1, got ${checkEvery}`)
  const snapshotEvery = options.reference?.snapshotEvery
  if (snapshotEvery !== undefined && !isCount(snapshotEvery))
    throw new ReplayRecordError(`snapshotEvery must be an integer >= 1, got ${snapshotEvery}`)

  const start = sim.snapshot()
  const view = sim.describeSnapshot(start).header
  const startTick = sim.tick
  const ticks: Array<{ tick: number; commands: ReplayCommand[] }> = []
  const checks: Array<{ tick: number; hash: string }> = []
  const hashes: string[] = []
  const snapshots: Array<{ tick: number; bytes: Uint8Array }> = []
  let expectedTick = startTick
  // Why the recorder is closed: finished, or a failure that leaves the recording inexact.
  let closed: string | undefined

  const refuseIfUnusable = (): void => {
    if (closed !== undefined) throw new ReplayRecordError(closed)
    if (sim.tick !== expectedTick) {
      closed = `the sim was stepped outside the recorder (expected tick ${expectedTick}, found ${sim.tick})`
      throw new ReplayRecordError(closed)
    }
  }

  return {
    step(commands) {
      refuseIfUnusable()
      const tick = sim.tick
      const result = sim.step(commands)
      expectedTick = result.tick

      // The sim reports rejections by the command object passed in; every other command was accepted.
      const rejections = new Map<Command, number>()
      for (const r of result.rejected) rejections.set(r.command, (rejections.get(r.command) ?? 0) + 1)
      const accepted: ReplayCommand[] = []
      for (const c of commands) {
        const left = rejections.get(c) ?? 0
        if (left > 0) {
          rejections.set(c, left - 1)
          continue
        }
        const payload = withoutUndefined(c.payload)
        try {
          canonicalJson(payload)
        } catch (err) {
          closed = `command "${c.type}" at tick ${tick} has a payload that is not canonical JSON`
          throw new ReplayRecordError(`${closed}: ${(err as Error).message}`, { cause: err })
        }
        accepted.push({ source: c.source, seq: c.seq, type: c.type, payload })
      }
      if (accepted.length > 0) {
        accepted.sort((a, b) => a.source - b.source || a.seq - b.seq) // the order the sim applies them
        ticks.push({ tick, commands: accepted })
      }

      const since = result.tick - startTick
      const wantSnapshot = snapshotEvery !== undefined && since % snapshotEvery === 0
      const wantHash = options.reference !== undefined || since % checkEvery === 0
      if (wantSnapshot || wantHash) {
        // sim.hash() is exactly this; taking the snapshot once serves both the hash and the reference snapshot.
        const bytes = sim.snapshot()
        const hash = hex64(xxhash64(bytes))
        if (since % checkEvery === 0) checks.push({ tick: result.tick, hash })
        if (options.reference) hashes.push(hash)
        if (wantSnapshot) snapshots.push({ tick: result.tick, bytes })
      }
      return result
    },
    finish() {
      refuseIfUnusable()
      closed = 'the recorder is finished'
      const replay: Replay = {
        header: {
          tickHz: sim.tickHz,
          seed: sim.seed,
          schemaHash: view.schemaHash,
          contentHash: view.contentHash,
          startTick,
          checkEvery,
          framework: SIM_VERSION,
          meta: { ...options.meta },
        },
        start,
        ticks,
        checks,
        finalTick: sim.tick,
        finalHash: sim.hash(),
      }
      return options.reference ? { ...replay, reference: { hashes, snapshots } } : replay
    },
  }
}
