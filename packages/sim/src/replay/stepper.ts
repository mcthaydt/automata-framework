// Re-simulates a Replay through the one simulation there is (M2.3 spec §3.4): a fresh sim restored from the
// replay's start snapshot, fed the recorded commands tick by tick, its hash compared at every check.
import type { PluginDef } from '../define/definitions'
import { hex64 } from '../hash/xxhash64'
import { type Command, createSim, type Sim, type StepResult } from '../world/sim'
import { decodeSnapshotHeader } from '../world/snapshot'
import { ReplayFormatError } from './errors'
import type { Replay, ReplayCommand } from './replay'

export interface ReplayStepSetup {
  readonly plugins: readonly PluginDef[]
  /** As SimOptions.content: the content the recording sim was given. */
  readonly content?: unknown
}

export interface ReplayCheck {
  readonly expected: string
  readonly actual: string
}

export interface ReplayStepper {
  readonly sim: Sim
  readonly tick: number
  readonly done: boolean
  /** One step. `check` is present at a check tick, the final tick, or when a recorded command was rejected. */
  step(): { readonly tick: number; readonly result: StepResult; readonly check?: ReplayCheck }
  /** Steps to the end; stops at the first failed check. `checks` counts the checks that passed. */
  run(): {
    readonly ok: boolean
    readonly checks: number
    readonly failed?: { readonly tick: number } & ReplayCheck
  }
  dispose(): void
}

/**
 * Throws SnapshotMismatchError when the replay's start snapshot belongs to another schema or content, and
 * SnapshotFormatError when it is malformed, and ReplayFormatError when the header disagrees with the start snapshot
 * it describes; the sim it created is disposed first.
 */
/**
 * The header is written from the start snapshot, so they agree in any replay the recorder made. A forged start
 * tick would let playback begin at or past finalTick and pass with no hash compared.
 */
function checkHeaderMatchesStart({ header, start }: Replay): void {
  const snapshot = decodeSnapshotHeader(start)
  if (snapshot.tick !== header.startTick)
    throw new ReplayFormatError(
      `the start snapshot is at tick ${snapshot.tick}, the header says startTick ${header.startTick}`,
    )
  for (const field of ['schemaHash', 'contentHash'] as const) {
    const actual = hex64(snapshot[field])
    if (actual !== header[field])
      throw new ReplayFormatError(`header ${field} ${header[field]} is not the start snapshot's ${actual}`)
  }
}

export async function createReplayStepper(replay: Replay, setup: ReplayStepSetup): Promise<ReplayStepper> {
  const { header } = replay
  const sim = await createSim({
    seed: header.seed,
    tickHz: header.tickHz,
    plugins: setup.plugins,
    ...(setup.content === undefined ? {} : { content: setup.content }),
  })
  try {
    sim.restore(replay.start)
    checkHeaderMatchesStart(replay)
  } catch (err) {
    sim.dispose()
    throw err
  }

  const commandsAt = new Map<number, readonly ReplayCommand[]>()
  for (const t of replay.ticks) commandsAt.set(t.tick, t.commands)
  // Expected hashes by tick: every check, plus the final hash.
  const expectedAt = new Map<number, string>()
  for (const c of replay.checks) expectedAt.set(c.tick, c.hash)
  if (!expectedAt.has(replay.finalTick)) expectedAt.set(replay.finalTick, replay.finalHash)
  let disposed = false

  const stepper: ReplayStepper = {
    sim,
    get tick() {
      return sim.tick
    },
    get done() {
      return sim.tick >= replay.finalTick
    },
    step() {
      if (stepper.done) throw new Error(`the replay is finished at tick ${replay.finalTick}`)
      const tick = sim.tick
      const commands: Command[] = (commandsAt.get(tick) ?? []).map((c) => ({ ...c, tick }))
      const result = sim.step(commands)
      // A recorded command was accepted when recorded; one this code rejects means the run cannot be the same.
      const rejected = result.rejected[0]
      if (rejected)
        return { tick: result.tick, result, check: { expected: 'accepted', actual: rejected.reason } }
      const expected = expectedAt.get(result.tick)
      if (expected === undefined) return { tick: result.tick, result }
      return { tick: result.tick, result, check: { expected, actual: sim.hash() } }
    },
    run() {
      let passed = 0
      if (stepper.done && sim.tick === replay.finalTick) {
        // An empty run: the start state is the final state.
        const actual = sim.hash()
        if (actual !== replay.finalHash)
          return { ok: false, checks: 0, failed: { tick: sim.tick, expected: replay.finalHash, actual } }
        return { ok: true, checks: 1 }
      }
      while (!stepper.done) {
        const { tick, check } = stepper.step()
        if (!check) continue
        if (check.expected !== check.actual) return { ok: false, checks: passed, failed: { tick, ...check } }
        passed += 1
      }
      return { ok: true, checks: passed }
    },
    dispose() {
      if (disposed) return
      disposed = true
      sim.dispose()
    },
  }
  return stepper
}
