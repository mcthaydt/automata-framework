import { describe, expect, it } from 'vitest'
import { apply, applyDir, compose, lerp3, type M } from '../../../shared/math/math.ts'
import { blend } from './blend.ts'
import { LIMBS } from './limbs.ts'
import { type PoseDef, poseSchema } from './pose.schema.ts'
import { angleBetween, eulerDegrees, slerp } from './rotation.ts'
import type { Vec3 } from './targets.ts'

const a: PoseDef = {
  about: 'a',
  effectors: {
    handL: { pos: [0.1, 1, 0.2], rot: [10, 20, 0], weight: 0.8 },
    handR: { pos: [-0.2, 0.9, 0.1] },
    chest: { rot: [5, 0, 0] },
  },
  poles: { elbowL: { dir: [1, -1, 0] } },
  fk: { 'clavicle.L': [0, 0, 10] },
  root: { yaw: 170 },
}
const b: PoseDef = {
  about: 'b',
  effectors: {
    handL: { pos: [0.3, 1.2, 0.4], rot: [-30, 60, 20] },
    chest: { rot: [-5, 20, 0] },
    footR: { pos: [-0.1, 0.1, 0.3] },
  },
  poles: { elbowL: { dir: [0, -1, -1] }, kneeR: { dir: [0, 0.2, 1] } },
  fk: { 'clavicle.L': [0, 0, -10], 'hand.R': [20, 0, 0] },
  root: { pos: [0, 0, 0.2], yaw: -170 },
}

const expectTurn = (got: Vec3 | undefined, want: ReturnType<typeof slerp>): void => {
  expect(got).toBeDefined()
  expect(angleBetween(eulerDegrees(got ?? [0, 0, 0]), want)).toBeLessThan(1e-9)
}

describe('blend', () => {
  it('is a at 0 and b at 1, as written', () => {
    expect(blend(a, b, 0)).toEqual(a)
    expect(blend(a, b, 1)).toEqual(b)
  })
  it('lerps positions and weights and slerps rotations', () => {
    const t = 0.25
    const mid = blend(a, b, t)
    const handL = mid.effectors.handL
    expect(handL?.pos?.[0]).toBeCloseTo(0.15, 15)
    expect(handL?.pos?.[1]).toBeCloseTo(1.05, 15)
    expect(handL?.weight).toBeCloseTo(0.85, 15)
    expectTurn(handL?.rot, slerp(eulerDegrees([10, 20, 0]), eulerDegrees([-30, 60, 20]), t))
    expectTurn(mid.effectors.chest?.rot, slerp(eulerDegrees([5, 0, 0]), eulerDegrees([-5, 20, 0]), t))
    expectTurn(mid.fk?.['clavicle.L'], slerp(eulerDegrees([0, 0, 10]), eulerDegrees([0, 0, -10]), t))
    expect(mid.about).toBeUndefined()
  })
  it('turns the root the short way round', () => {
    expect(blend(a, b, 0.5).root?.yaw).toBeCloseTo(180, 12)
    expect(blend(a, b, 0.25).root?.yaw).toBeCloseTo(175, 12)
  })
  it("fades a handle only one pose names against the layers below, by that pose's share", () => {
    const mid = blend(a, b, 0.25)
    // a's alone: its targets, its weight (1 when left out) times 1 − t.
    expect(mid.effectors.handR).toEqual({ pos: [-0.2, 0.9, 0.1], weight: 0.75 })
    // b's alone: times t.
    expect(mid.effectors.footR).toEqual({ pos: [-0.1, 0.1, 0.3], weight: 0.25 })
  })
  it("blends a pole one pose leaves out from that limb's default pole", () => {
    const mid = blend(a, b, 0.25)
    const kneeDefault = LIMBS.footR.defaultPole
    expect(mid.poles?.kneeR).toEqual({ dir: lerp3([...kneeDefault], [0, 0.2, 1], 0.25) })
    expect(mid.poles?.elbowL?.dir).toEqual(lerp3([1, -1, 0], [0, -1, -1], 0.25))
  })
  it('blends an fk joint or a root field one pose leaves out from zero', () => {
    const mid = blend(a, b, 0.25)
    expectTurn(mid.fk?.['hand.R'], slerp(eulerDegrees([0, 0, 0]), eulerDegrees([20, 0, 0]), 0.25))
    expect(mid.root?.pos?.[2]).toBeCloseTo(0.05, 15)
  })
  it('holds a field only one of the two sets inside a handle both name', () => {
    const one: PoseDef = { effectors: { handL: { pos: [0, 1, 0], rot: [10, 0, 0] } } }
    const two: PoseDef = { effectors: { handL: { pos: [0, 1, 0.4] } } }
    expect(blend(one, two, 0.5).effectors.handL?.rot).toEqual([10, 0, 0])
  })
  it('refuses a handle both name in different spaces, naming it', () => {
    const root: PoseDef = { effectors: { handL: { pos: [0, 1, 0] } } }
    const chest: PoseDef = { effectors: { handL: { pos: [0, -0.2, 0.3], space: 'chest' } } }
    expect(() => blend(root, chest, 0.5)).toThrow(/handL/)
    expect(() =>
      blend({ effectors: {}, poles: { elbowR: { dir: [0, -1, 0], space: 'chest' } } }, b, 0.5),
    ).toThrow(RangeError)
  })
  it('blends a pair in different spaces in root space through a chest frame, when given one', () => {
    const chest: M = compose(eulerDegrees([10, 25, -5]), [0.01, 1.2, 0.03])
    const inChest: PoseDef = {
      effectors: { handL: { pos: [0.15, -0.23, 0.3], space: 'chest' } },
      poles: { elbowR: { dir: [-1, -1, 0], space: 'chest' } },
    }
    const inRoot: PoseDef = { effectors: { handL: { pos: [0.3, 1, 0.2] } } }
    const mid = blend(inChest, inRoot, 0.25, { chest })
    expect(mid.effectors.handL).toEqual({ pos: lerp3(apply(chest, [0.15, -0.23, 0.3]), [0.3, 1, 0.2], 0.25) })
    // A pole only one pose sets, in chest space, blends from the default pole (root space) once converted.
    expect(mid.poles?.elbowR).toEqual({
      dir: lerp3(applyDir(chest, [-1, -1, 0]), [...LIMBS.handR.defaultPole], 0.25),
    })
    expect(() => blend(inChest, { effectors: {} }, 0.25)).toThrow(/elbowR.*chest frame/)
  })
  it('clamps t to 0..1 and refuses a t that is not a number', () => {
    expect(blend(a, b, -1)).toEqual(a)
    expect(blend(a, b, 2)).toEqual(b)
    expect(() => blend(a, b, Number.NaN)).toThrow(RangeError)
  })
  it('blends turns at and near pitch ±90° without inventing yaw or roll (gimbal lock)', () => {
    for (const rot of [
      [-90, 20, 0],
      [90, -40, 25],
      [89.9999, 30, -10],
      [-89.9999, -120, 45],
    ] as Vec3[]) {
      const p: PoseDef = { effectors: { head: { rot } } }
      const mid = blend(p, p, 0.5).effectors.head?.rot
      expectTurn(mid, eulerDegrees(rot))
    }
    const lock: PoseDef = { effectors: { head: { rot: [-90, 20, 0] } } }
    expect(blend(lock, lock, 0.5).effectors.head?.rot?.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([
      -90, 20, 0,
    ])
  })
  it('never writes -0', () => {
    const zero: PoseDef = {
      effectors: { handL: { pos: [0, 1, 0], rot: [0, 0, 0] } },
      root: { pos: [0, 0, 0], yaw: 0 },
    }
    const negative: PoseDef = {
      effectors: { handL: { pos: [-0, 1, -0], rot: [0, 0, 0] } },
      root: { pos: [-0, 0, -0], yaw: -0 },
    }
    const numbers = (v: unknown): number[] =>
      typeof v === 'number'
        ? [v]
        : typeof v === 'object' && v !== null
          ? Object.values(v).flatMap(numbers)
          : []
    for (const n of numbers(blend(zero, negative, 0.5))) expect(Object.is(n, -0)).toBe(false)
  })
  it('gives a pose the schema accepts', () => {
    for (const t of [0.1, 0.5, 0.9]) expect(poseSchema.safeParse(blend(a, b, t)).success).toBe(true)
  })
})
