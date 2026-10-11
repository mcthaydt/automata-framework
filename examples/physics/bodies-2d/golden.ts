// A scripted run of the demo's sim: Wick walks into the crates and back while bodies drop on fixed ticks. The
// golden tests replay it and compare the final state hash, in Node (golden.test.ts) and in Chromium, WebKit and
// Firefox (golden.parity.test.ts): the pile must come out bit for bit the same on every engine (AGENTS.md,
// determinism). A change to the bodies, the physics extension or the base's sim changes the hash on purpose:
// investigate it, never rebaseline it per engine.
import { moveCommand, ROOM } from '@af-examples/base-2d'
import { createBodiesSim } from './bodies-sim.ts'
import { Drop } from './sim/bodies.plugin.ts'

/** Ticks the golden run lasts: long enough for every drop to land and tumble. */
export const GOLDEN_TICKS = 360
/** The ticks a body drops on: a crate on even ticks, a stone on odd ones. */
export const GOLDEN_DROPS: readonly number[] = [10, 25, 26, 60, 61, 62, 63, 120, 121, 200, 240, 241]
/** The sim's state hash after the golden run, recorded in Node on 2026-10-11. */
export const GOLDEN_HASH = '54bfb33a9790ef21'

/** Wick walks right for 90 ticks, waits, walks back left for 90, then waits out the rest. */
function wickX(tick: number): -1 | 0 | 1 {
  if (tick < 90) return 1
  if (tick >= 150 && tick < 240) return -1
  return 0
}

/** Replays the golden run on a fresh sim and reports what the golden tests compare. */
export async function runGolden(): Promise<{ hash: string; rejected: number; collisions: number }> {
  const sim = await createBodiesSim(ROOM)
  let rejected = 0
  let collisions = 0
  for (let i = 0; i < GOLDEN_TICKS; i++) {
    const commands = [moveCommand(sim, { x: wickX(sim.tick), jump: false })]
    if (GOLDEN_DROPS.includes(sim.tick))
      commands.push({ tick: sim.tick, source: 0, seq: 0x80000000 + sim.tick, type: Drop.id, payload: {} })
    const result = sim.step(commands)
    rejected += result.rejected.length
    for (const event of result.events) if (event.type === 'physics2d.collision-started') collisions++
  }
  const hash = sim.hash()
  sim.dispose()
  return { hash, rejected, collisions }
}
