// A scripted run of the demo's sim: Wick walks into the crates, jumps, and walks back while bodies drop on fixed
// ticks (some under the low platform, so the drop's climb above it is pinned too). The
// golden tests replay it and compare the final state hash, in Node (golden.test.ts) and in Chromium, WebKit and
// Firefox (golden.parity.test.ts): the pile must come out bit for bit the same on every engine (AGENTS.md,
// determinism). A change to the bodies, the physics extension or the base's sim changes the hash on purpose:
// investigate it, never rebaseline it per engine.
import { moveCommand, ROOM } from '@af-examples/base-2d'
import type { Command, Sim, StepResult } from '@mcthaydt/automata-sim'
import type { Recorder } from '@mcthaydt/automata-sim/replay'
import { createBodiesSim } from './bodies-sim.ts'
import { Drop } from './sim/bodies.plugin.ts'

/** Ticks the golden run lasts (ten seconds): long enough for every drop to land and the pile to settle. */
export const GOLDEN_TICKS = 600
/** The ticks a body drops on: a crate on even ticks, a stone on odd ones. */
export const GOLDEN_DROPS: readonly number[] = [10, 25, 26, 60, 61, 62, 63, 120, 121, 200, 240, 241, 400, 401]
/** The sim's state hash after the golden run, re-recorded in Node on 2026-10-11 (M2.1b: Prop tags, drop heights, the jump). */
export const GOLDEN_HASH = 'ad621eea6325a8db'

/** Wick walks right for 90 ticks, waits, walks back left for 90, then waits out the rest. */
function wickX(tick: number): -1 | 0 | 1 {
  if (tick < 90) return 1
  if (tick >= 150 && tick < 240) return -1
  return 0
}

/** Wick jumps (holding the button for a full jump) while walking into the crates. */
const wickJumps = (tick: number) => tick >= 70 && tick < 82

/** Steps `sim` through the golden run with `step` (sim.step, or a recorder's step); returns every result. */
function drive(sim: Sim, step: (commands: readonly Command[]) => StepResult): StepResult[] {
  const results: StepResult[] = []
  for (let i = 0; i < GOLDEN_TICKS; i++) {
    const commands: Command[] = [moveCommand(sim, { x: wickX(sim.tick), jump: wickJumps(sim.tick) })]
    if (GOLDEN_DROPS.includes(sim.tick))
      commands.push({ tick: sim.tick, source: 0, seq: 0x80000000 + sim.tick, type: Drop.id, payload: {} })
    results.push(step(commands))
  }
  return results
}

/** Records the golden run (golden.test.ts's bodies.replay). */
export function goldenDrive(recorder: Recorder, sim: Sim): void {
  drive(sim, (commands) => recorder.step(commands))
}

/** Replays the golden run on a fresh sim and reports what the golden tests compare. */
export async function runGolden(): Promise<{
  hash: string
  rejected: number
  collisions: number
  seed: number
  ticks: number
}> {
  const sim = await createBodiesSim(ROOM)
  const startTick = sim.tick
  const results = drive(sim, (commands) => sim.step(commands))
  let rejected = 0
  let collisions = 0
  for (const result of results) {
    rejected += result.rejected.length
    for (const event of result.events) if (event.type === 'physics2d.collision-started') collisions++
  }
  const hash = sim.hash()
  const ticks = sim.tick - startTick
  sim.dispose()
  return { hash, rejected, collisions, seed: sim.seed, ticks }
}
