// How the bounce goldens drive the fixture: three balls set up before tick 0, then a kick now and then.
import { type Command, createRng, deriveSeed, type Rng, type Sim } from '@mcthaydt/automata-sim'
import type { Recorder } from '@mcthaydt/automata-sim/replay'
import { Ball } from './bounce.component'

export const BOUNCE_SEED = 42
export const BOUNCE_TICKS = 300

export function bounceSetup(sim: Sim): void {
  sim.spawn([[Ball, { x: 100, y: 200, vx: 7, vy: 3 }]])
  sim.spawn([[Ball, { x: 500, y: 500, vx: 1, vy: -1 }]])
  sim.spawn([[Ball, { x: 900, y: 50, vx: -11, vy: 9 }]])
}

/** A kick on one of the first three balls every 25 ticks; `seq` is the tick, so it is unique per source. */
export function bounceScript(tick: number, rng: Rng): readonly Command[] {
  if (tick % 25 !== 5) return []
  return [
    {
      tick,
      source: 0,
      seq: tick,
      type: 'bounce.kick',
      payload: { ball: 1 + rng.int(3), dvx: rng.int(7) - 3 },
    },
  ]
}

/**
 * Drives a recording of the bounce run: BOUNCE_TICKS steps of bounceScript, from the rng stream simGolden gives a
 * script, so bounce.replay and bounce.golden.json pin the same run.
 */
export function bounceDrive(recorder: Recorder, sim: Sim): void {
  const rng = createRng(deriveSeed(BOUNCE_SEED, 'golden-script'))
  for (let t = 0; t < BOUNCE_TICKS; t++) recorder.step(bounceScript(sim.tick, rng))
}
