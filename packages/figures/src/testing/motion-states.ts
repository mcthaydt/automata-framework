// The motion states the goldens (testing/__goldens__/figurebuilder-motion.json) were taken in, by label, and
// the walk, idle and turn the hold-invariance test runs (The Last Light tests/procedural-figure.test.ts
// `states` at 92e6704, without its actions). FigureBuilder (mcthaydt/FigureBuilder) at a1f7246 ran `base()`
// and `evaluate()` in each with `view: 0` and no `lookUp` or `pitch` (M3.5c plan, decisions 5 and 9).

import type { MotionState } from '../motion/motion-state'

/** At rest: standing, facing +z, the clocks at 0. */
export const AT_REST: MotionState = { t: 0, moving: false, phase: 0, yaw: 0, headYaw: 0, shuffle: 0 }

const at = (state: Partial<MotionState>): MotionState => ({ ...AT_REST, ...state })

/** The goldens' states. Walking at t 0.5, where no twitch falls (the twitch is idle's, decision 11). */
export const GOLDEN_STATES: Readonly<Record<string, MotionState>> = {
  'walk 0': at({ moving: true, phase: 0, yaw: 0.3, t: 0.5 }),
  'walk 0.125': at({ moving: true, phase: 0.125, yaw: 0.3, t: 0.5 }),
  'walk 0.3': at({ moving: true, phase: 0.3, yaw: 0.3, t: 0.5 }),
  'walk 0.55': at({ moving: true, phase: 0.55, yaw: 0.3, t: 0.5 }),
  'walk 0.8': at({ moving: true, phase: 0.8, yaw: 0.3, t: 0.5 }),
  'walk clear': at({ moving: true, phase: 0.4, t: 0.5, clear: [0.2, 0.35] }),
  'idle 0': at({ t: 0, yaw: -1.2 }),
  'idle 0.7': at({ t: 0.7, yaw: -1.2 }),
  'idle 2.3': at({ t: 2.3, yaw: -1.2 }),
  'idle hair': at({ t: 1.1, hair: { pitch: 0.2, roll: -0.1 } }),
  'turn 0.25': at({ t: 0.125, yaw: 2, headYaw: 0.6, shuffle: 0.25 }),
  'turn 0.5': at({ t: 0.25, yaw: 2, headYaw: 0.6, shuffle: 0.5 }),
  'turn 0.75': at({ t: 0.375, yaw: 2, headYaw: 0.6, shuffle: 0.75 }),
}

/** Every locomotion a figure plays: the walk across its cycle, idle over time, a turn on the spot. */
export function locomotionStates(): [string, MotionState][] {
  const out: [string, MotionState][] = []
  for (let i = 0; i < 24; i++)
    out.push([`walk ${i}`, at({ t: i / 12, moving: true, phase: i / 24, yaw: 0.3 })])
  for (let i = 0; i < 12; i++) out.push([`idle ${i}`, at({ t: i * 0.7, yaw: -1.2 })])
  for (let i = 0; i < 4; i++) out.push([`turn ${i}`, at({ t: i / 8, yaw: 2, headYaw: 0.6, shuffle: i / 4 })])
  return out
}
