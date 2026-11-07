import { describe, expect, it } from 'vitest'
import {
  apply,
  applyDir,
  compose,
  invertRigid,
  type M,
  matq,
  mmul,
  mul3,
  qmat,
  rotationOf,
} from '../../../shared/math/math.ts'
import { unit, WICK } from '../../../testing/solve-fixtures.ts'
import { fk, J, restPose } from '../body/rig.ts'
import { blend } from '../motion/blend.ts'
import type { PoseDef } from '../motion/pose.schema.ts'
import { degrees, eulerDegrees, eulerOf } from '../motion/rotation.ts'
import type { Vec3 } from '../motion/targets.ts'
import type { FigureClipDef } from './clip.schema.ts'
import { easeAt } from './ease.ts'
import { chestFrame, type PoseLibrary, sample } from './sample.ts'

const up: PoseDef = { effectors: { handR: { pos: [-0.1, 1.3, 0.25] }, chest: { rot: [5, 0, 0] } } }
const down: PoseDef = { effectors: { handR: { pos: [-0.2, 0.8, 0.05] }, chest: { rot: [-5, 10, 0] } } }
const POSES: PoseLibrary = { up, down }

const clip = (keys: FigureClipDef['keys']): FigureClipDef => ({
  length: keys.at(-1)?.t ?? 0,
  loop: 'once',
  mask: ['armR', 'torso'],
  keys,
})

describe('sample', () => {
  const c = clip([
    { t: 0, pose: 'down' },
    { t: 0.5, pose: 'up', ease: 'inOut' },
    { t: 0.75, pose: down, ease: 'step' },
    { t: 1, pose: 'up' },
  ])
  it("is a key's pose at its time, ids looked up in the library", () => {
    expect(sample(c, 0, POSES)).toEqual(down)
    expect(sample(c, 0.5, POSES)).toEqual(up)
    expect(sample(c, 1, POSES)).toEqual(up)
  })
  it('blends the neighbouring keys at the eased fraction', () => {
    expect(sample(c, 0.125, POSES)).toEqual(blend(down, up, easeAt('inOut', 0.25)))
    expect(sample(c, 0.875, POSES)).toEqual(blend(down, up, 0.5))
  })
  it('holds the previous key through a step', () => {
    expect(sample(c, 0.6, POSES)).toEqual(up)
    expect(sample(c, 0.75, POSES)).toEqual(down)
  })
  it('follows an ease that overshoots past the key and back (positions and turns extrapolate, weights stay 0..1)', () => {
    const a: PoseDef = { effectors: { handR: { pos: [0, 1, 0], weight: 0.9 }, head: { rot: [0, 0, 0] } } }
    const b: PoseDef = { effectors: { handR: { pos: [0, 1, 0.4] }, head: { rot: [0, 40, 0] } } }
    const overshoot = clip([
      { t: 0, pose: a },
      { t: 1, pose: b, ease: [0.3, 1.6, 0.6, 1] },
    ])
    const u = easeAt([0.3, 1.6, 0.6, 1], 0.7)
    expect(u).toBeGreaterThan(1)
    const got = sample(overshoot, 0.7, {})
    expect(got.effectors.handR?.pos?.[2]).toBeCloseTo(0.4 * u, 12)
    expect(got.effectors.head?.rot?.[1]).toBeCloseTo(40 * u, 9)
    expect(got.effectors.handR?.weight).toBe(1)
  })
  it('clamps t to the clip', () => {
    expect(sample(c, -1, POSES)).toEqual(down)
    expect(sample(c, 3, POSES)).toEqual(up)
  })
  it('refuses a key naming a pose the library lacks, by name', () => {
    expect(() =>
      sample(
        clip([
          { t: 0, pose: 'gone' },
          { t: 1, pose: 'up' },
        ]),
        0.5,
        POSES,
      ),
    ).toThrow(/gone/)
  })
})

describe('keys in different spaces', () => {
  // A chest turned and raised, as the layers below might leave it.
  const chest: M = compose(eulerDegrees([10, 25, -5]), [0.01, 1.2, 0.03])
  const turnIn = (m: M, rot: Vec3): Vec3 => {
    const e = eulerOf(matq(mul3(rotationOf(m), qmat(eulerDegrees(rot)))))
    return [degrees(e[0]), degrees(e[1]), degrees(e[2])]
  }
  const inChest: PoseDef = {
    effectors: {
      handL: { pos: [0.15, -0.23, 0.3], rot: [20, 0, 0], space: 'chest' },
      head: { rot: [0, 5, 0] },
    },
    poles: { elbowL: { dir: [1, -1, 0], space: 'chest' } },
  }
  const inRoot: PoseDef = {
    effectors: { handL: { pos: [0.3, 1, 0.2], rot: [-10, 0, 0] }, head: { rot: [0, -5, 0] } },
    poles: { elbowL: { dir: [0.5, -1, -0.5] } },
  }
  const c = clip([
    { t: 0, pose: inChest },
    { t: 1, pose: inRoot },
  ])
  it('converts the chest-space side to root space through the chest frame, then blends', () => {
    const converted: PoseDef = {
      effectors: {
        handL: { pos: apply(chest, [0.15, -0.23, 0.3]), rot: turnIn(chest, [20, 0, 0]) },
        head: { rot: [0, 5, 0] },
      },
      poles: { elbowL: { dir: applyDir(chest, [1, -1, 0]) } },
    }
    const got = sample(c, 0.25, {}, { chest })
    const want = blend(converted, inRoot, 0.25)
    expect(got.effectors.handL?.space).toBeUndefined()
    for (let i = 0; i < 3; i++) {
      expect(got.effectors.handL?.pos?.[i]).toBeCloseTo(want.effectors.handL?.pos?.[i] ?? Number.NaN, 12)
      expect(got.effectors.handL?.rot?.[i]).toBeCloseTo(want.effectors.handL?.rot?.[i] ?? Number.NaN, 9)
      expect(got.poles?.elbowL?.dir[i]).toBeCloseTo(want.poles?.elbowL?.dir[i] ?? Number.NaN, 12)
    }
    expect(got.effectors.head).toEqual(want.effectors.head)
  })
  it('converts a chest pole against a key that leaves the pole to its default', () => {
    const noPole: PoseDef = { effectors: { handL: { pos: [0.15, -0.2, 0.3], space: 'chest' } } }
    const twoKeys = clip([
      { t: 0, pose: { effectors: inChest.effectors, poles: inChest.poles } },
      { t: 1, pose: noPole },
    ])
    const got = sample(twoKeys, 0.5, {}, { chest })
    expect(got.poles?.elbowL?.space).toBeUndefined()
    // The hands agree on chest space, so they stay in it.
    expect(got.effectors.handL?.space).toBe('chest')
  })
  it('refuses a mixed pair with no chest frame, naming the channel', () => {
    expect(() => sample(c, 0.5, {})).toThrow(/handL/)
  })
  it('needs no chest frame at a key itself', () => {
    expect(sample(c, 0, {})).toEqual(inChest)
  })
})

describe('chestFrame', () => {
  it("is the chest joint's frame in root space, in figure units", () => {
    const base = restPose()
    base.root = [2, 0, -1]
    base.yaw = 0.7
    base.rot[J.spine] = eulerDegrees([10, 5, 0])
    const world = fk(WICK, base)
    const frame = chestFrame(WICK, world)
    const local = mmul(
      invertRigid(world[J.root] ?? compose([0, 0, 0, 1], [0, 0, 0])),
      world[J.chest] ?? frame,
    )
    for (let i = 0; i < 9; i++) expect(frame[i]).toBeCloseTo(local[i] ?? Number.NaN, 12)
    for (let i = 9; i < 12; i++) expect(frame[i]).toBeCloseTo((local[i] ?? Number.NaN) / unit(WICK), 12)
  })
})
