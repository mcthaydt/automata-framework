import { beforeAll, describe, expect, it } from 'vitest'
import { gaitOf } from '#src/features/figures/motion/gait-of.ts'
import { evaluateMotion } from '#src/features/figures/motion/hold.ts'
import type { MotionState } from '#src/features/figures/motion/motion-state.ts'
import { spriteCheats } from '#src/features/figures/paint/sprite-cheats.ts'
import { type FixtureMotion, fixtureMotion } from '#src/testing/fixture-motion.ts'

let fixture: FixtureMotion
beforeAll(async () => {
  fixture = await fixtureMotion()
})

const IDLE: MotionState = { t: 0.4, moving: false, phase: 0, yaw: 0.6, headYaw: 0.2, shuffle: 0 }
const WALK: MotionState = { t: 0.4, moving: true, phase: 0.3, yaw: 0.6, headYaw: 0.2, shuffle: 0 }
const FACE = { camera: 0.6, turn: 0.1 }

describe('the sprite cheats in the pose', () => {
  it.each([
    ['idle', IDLE],
    ['walk', WALK],
  ])('with none given, the %s pose is the figure’s own', (_name, state) => {
    const { body, wick, library } = fixture
    const gait = gaitOf(wick, library.gaits)
    const plain = evaluateMotion(body, gait, state)
    const cheated = evaluateMotion(body, gait, {
      ...state,
      lookUp: undefined,
      view: undefined,
      pitch: undefined,
    })
    expect(cheated.world).toEqual(plain.world)
  })
  it('tips the head back only as far as the face is turned to the camera', () => {
    const { body, wick, library } = fixture
    const gait = gaitOf(wick, library.gaits)
    const facing = evaluateMotion(body, gait, { ...IDLE, view: 0, lookUp: 0.3 })
    const profile = evaluateMotion(body, gait, { ...IDLE, view: Math.PI / 2, lookUp: 0.3 })
    const plain = evaluateMotion(body, gait, IDLE)
    expect(facing.world).not.toEqual(plain.world)
    // In profile (cos 90° ≈ 0) the tip back all but vanishes.
    const drift = (a: typeof plain, b: typeof plain): number =>
      Math.max(...a.world.map((m, i) => Math.max(...m.map((x, k) => Math.abs(x - (b.world[i]?.[k] ?? 0))))))
    const profileWithout = evaluateMotion(body, gait, { ...IDLE, view: Math.PI / 2 })
    expect(drift(profile, profileWithout)).toBeLessThan(drift(facing, plain) / 100)
  })
})

describe('spriteCheats', () => {
  it('turns a head at 45° a further 0.2 toward the camera, none square on or in profile', () => {
    const at = (deg: number) => spriteCheats((deg * Math.PI) / 180, 0, 0.3, FACE, 0.8).headYaw
    expect(at(0)).toBeCloseTo(0, 12)
    expect(at(90)).toBeCloseTo(-(Math.PI / 2) * FACE.turn, 12)
    // At 45° the turn toward the camera is the profile share plus the three-quarter cheat's 0.2.
    expect(at(45)).toBeCloseTo(-(Math.PI / 4) * FACE.turn - 0.2, 12)
    expect(at(-45)).toBeCloseTo((Math.PI / 4) * FACE.turn + 0.2, 12)
    // From behind the head does not turn toward the camera.
    expect(at(180)).toBeCloseTo(0, 12)
  })
  it('leads in 30° steps, never past the gait’s lead', () => {
    const lead = (rad: number, most = 0.8) => spriteCheats(0, rad, 0, FACE, most).headYaw
    expect(lead(0.3)).toBeCloseTo(Math.PI / 6, 12)
    expect(lead(0.1)).toBeCloseTo(0, 12)
    expect(lead(3, 0.5)).toBe(0.5)
    expect(lead(-3, 0.5)).toBe(-0.5)
  })
  it('tips by the face’s share of the camera’s pitch and carries the view', () => {
    expect(spriteCheats(0.4, 0, 0.3, FACE, 0.8)).toMatchObject({ lookUp: 0.18, view: 0.4, pitch: 0.3 })
  })
})
