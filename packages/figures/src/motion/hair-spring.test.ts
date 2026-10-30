// The hair spring as a pure step (M3 spec §4.4.1, §4.4.5 step 7): FigureBuilder's (mcthaydt/FigureBuilder)
// `Figure.swingHair` (src/render/figure/figure.ts at a1f7246), state in and state out, checked step for step
// against the source's numbers (testing/__goldens__/figurebuilder-motion.json `hair`).

import { describe, expect, it } from 'vitest'
import type { M } from '../math/math'
import { expectClose, MOTION_GOLDENS } from '../testing/motion-goldens'
import { DEFAULT_HAIR } from './gait-of'
import { HAIR_AT_REST, type HairInput, type HairSpring, hairStep, headNod } from './hair-spring'

/** The elderly gait's tuned speed, which the goldens' figure walked at. */
const ELDERLY_SPEED = 1.05
/** The keeper's head tilt in the goldens' stand-in figure. */
const HEAD_TILT = 0.05

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}
const walking: HairInput = { moving: true, phase: 0.3, speed: 1.4, yawRate: 0, nod: 0, headTilt: 0 }
const settle = (input: HairInput, seconds: number, dt = 1 / 60): HairSpring => {
  let spring = HAIR_AT_REST
  for (let t = 0; t < seconds; t += dt) spring = hairStep(DEFAULT_HAIR, spring, input, dt)
  return spring
}

describe('hairStep', () => {
  it("matches FigureBuilder's spring step for step (40 steps: standing, walking, turning, mixed frame times)", () => {
    expect(MOTION_GOLDENS.hair).toHaveLength(40)
    for (const [n, step] of MOTION_GOLDENS.hair.entries()) {
      const input: HairInput = {
        moving: step.moving,
        phase: step.phase,
        speed: ELDERLY_SPEED,
        yawRate: step.yawRate,
        nod: step.head ? headNod(step.head as M, step.shown) : 0,
        headTilt: HEAD_TILT,
      }
      const after = hairStep(DEFAULT_HAIR, step.before, input, step.dt)
      for (const key of ['pitch', 'roll', 'vPitch', 'vRoll'] as const)
        expectClose(after[key], step.after[key], `step ${n} ${key}`)
    }
  })
  it('is pure: frozen input, the same output twice', () => {
    const spring = deepFreeze({ pitch: 0.1, roll: -0.05, vPitch: 0.3, vRoll: 0 })
    const input = deepFreeze({ ...walking, yawRate: 1.2 })
    const a = hairStep(DEFAULT_HAIR, spring, input, 1 / 60)
    expect(hairStep(DEFAULT_HAIR, spring, input, 1 / 60)).toEqual(a)
    expect(a).not.toEqual(spring)
  })
  it('rests at its hang: standing level, it stays at rest', () => {
    expect(settle({ ...walking, moving: false }, 2)).toEqual(HAIR_AT_REST)
  })
  it('trails behind a walk and swings out against a turn', () => {
    expect(settle(walking, 3).pitch).toBeGreaterThan(0.05)
    // Turning toward the figure's left, the hair rolls the other way.
    expect(settle({ ...walking, moving: false, yawRate: 2 }, 3).roll).toBeLessThan(-0.05)
  })
  it('is the same whatever the frame rate: one 1/30 s step is two 1/60 s steps', () => {
    const start: HairSpring = { pitch: 0.2, roll: 0.1, vPitch: -0.4, vRoll: 0.2 }
    const once = hairStep(DEFAULT_HAIR, start, walking, 1 / 30)
    const twice = hairStep(DEFAULT_HAIR, hairStep(DEFAULT_HAIR, start, walking, 1 / 60), walking, 1 / 60)
    for (const key of ['pitch', 'roll', 'vPitch', 'vRoll'] as const) expectClose(once[key], twice[key], key)
  })
  it('a zero step changes nothing', () => {
    const start: HairSpring = { pitch: 0.2, roll: 0.1, vPitch: -0.4, vRoll: 0.2 }
    expect(hairStep(DEFAULT_HAIR, start, walking, 0)).toEqual(start)
  })
})
