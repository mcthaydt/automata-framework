import { describe, expect, it } from 'vitest'
import { blend } from '../motion/blend.ts'
import type { PoseDef } from '../motion/pose.schema.ts'
import { eulerDegrees, eulerOf } from '../motion/rotation.ts'
import type { FigureClipDef } from './clip.schema.ts'
import { addTurns, clipLayer, type Layer, mergeLayer, rampWeight } from './layers.ts'
import { sample } from './sample.ts'

const UP: PoseDef = { effectors: { handR: { pos: [-0.1, 1.4, 0.2] } } }
const OUT: PoseDef = { effectors: { handR: { pos: [-0.1, 1.2, 0.5] }, chest: { rot: [0, 20, 0] } } }
const CLIP: FigureClipDef = {
  length: 0.4,
  loop: 'once',
  mask: ['armR'],
  blend: { inMs: 100, outMs: 200 },
  keys: [
    { t: 0, pose: 'up' },
    { t: 0.4, pose: 'out' },
  ],
}
const POSES = { up: UP, out: OUT }

describe('rampWeight', () => {
  it('ramps in over inMs, and is 0 before the start', () => {
    expect(rampWeight(CLIP, -0.01)).toBe(0)
    expect(rampWeight(CLIP, 0)).toBe(0)
    expect(rampWeight(CLIP, 0.05)).toBeCloseTo(0.5, 12)
    expect(rampWeight(CLIP, 0.1)).toBe(1)
    expect(rampWeight(CLIP, 0.3)).toBe(1)
  })
  it('ramps out over outMs from the end, then is 0', () => {
    expect(rampWeight(CLIP, 0.4, 0.4)).toBe(1)
    expect(rampWeight(CLIP, 0.5, 0.4)).toBeCloseTo(0.5, 12)
    expect(rampWeight(CLIP, 0.6, 0.4)).toBeCloseTo(0, 12)
    expect(rampWeight(CLIP, 0.9, 0.4)).toBe(0)
  })
  it('cuts with no ramp: full from the start, gone after the end', () => {
    const cut = { ...CLIP, blend: undefined }
    expect(rampWeight(cut, 0)).toBe(1)
    expect(rampWeight(cut, 0.4, 0.4)).toBe(1)
    expect(rampWeight(cut, 0.41, 0.4)).toBe(0)
  })
})

describe('clipLayer', () => {
  const options = { rate: 12, smooth: true, poses: POSES }
  it('is the masked sample at the clip time, with its ramp weight', () => {
    const layer = clipLayer(CLIP, 0.25, { ...options, end: 0.4 }) as Layer
    expect(layer.weight).toBe(1)
    expect(layer.additive).toBe(false)
    // The chest is outside the mask.
    const sampled = sample(CLIP, 0.25, POSES)
    expect(layer.pose).toEqual({ effectors: { handR: sampled.effectors.handR }, poles: {}, fk: {} })
  })
  it('samples at the pose step when not smooth', () => {
    const stepped = clipLayer(CLIP, 0.2, { ...options, smooth: false, end: 0.4 }) as Layer
    // 0.2 s at 12 a second is in the step that starts at 2/12 s.
    expect(stepped.pose.effectors.handR).toEqual(sample(CLIP, 2 / 12, POSES).effectors.handR)
  })
  it('holds a once clip on its last pose while it fades, then is gone', () => {
    const fading = clipLayer(CLIP, 0.5, { ...options, end: 0.4 }) as Layer
    expect(fading.weight).toBeCloseTo(0.5, 12)
    expect(fading.pose.effectors.handR).toEqual(OUT.effectors.handR)
    expect(clipLayer(CLIP, 0.7, { ...options, end: 0.4 })).toBeUndefined()
  })
  it('marks an additive clip', () => {
    expect(clipLayer({ ...CLIP, mode: 'additive' }, 0.2, options)?.additive).toBe(true)
  })
})

describe('mergeLayer', () => {
  const below: PoseDef = {
    effectors: { handR: { pos: [-0.2, 0.8, 0] }, handL: { pos: [0.2, 0.8, 0] } },
    fk: { 'clavicle.L': [0, 0, 6] },
  }
  const layer = (pose: PoseDef, weight: number): Layer => ({
    pose,
    weight,
    mask: ['armR', 'torso'],
    additive: false,
  })
  it('blends a channel both name at the weight, and leaves the channels the layer does not name', () => {
    const merged = mergeLayer(below, layer({ effectors: { handR: { pos: [0, 1.2, 0.4] } } }, 0.25))
    expect(merged.effectors.handR).toEqual(
      blend(
        { effectors: { handR: { pos: [-0.2, 0.8, 0] } } },
        { effectors: { handR: { pos: [0, 1.2, 0.4] } } },
        0.25,
      ).effectors.handR,
    )
    expect(merged.effectors.handL).toEqual(below.effectors.handL)
    expect(merged.fk?.['clavicle.L']).toEqual([0, 0, 6])
  })
  it('brings a channel only the layer names in at its weight times the ramp', () => {
    const merged = mergeLayer(below, layer({ effectors: { chest: { rot: [0, 20, 0], weight: 0.8 } } }, 0.5))
    expect(merged.effectors.chest).toEqual({ rot: [0, 20, 0], weight: 0.4 })
  })
  it('is the layer itself on its channels at weight 1', () => {
    const merged = mergeLayer(below, layer(OUT, 1))
    expect(merged.effectors.handR).toEqual(OUT.effectors.handR)
    expect(merged.effectors.chest).toEqual(OUT.effectors.chest)
  })
})

describe('addTurns', () => {
  const additive = (pose: PoseDef, weight: number): Layer => ({
    pose,
    weight,
    mask: ['torso', 'head'],
    additive: true,
  })
  const close = (a: readonly number[] | undefined, b: readonly number[]) =>
    b.forEach((v, i) => {
      expect(a?.[i]).toBeCloseTo(v, 9)
    })
  it('composes fk turns onto the pose, scaled by the weight', () => {
    const below: PoseDef = { effectors: {}, fk: { neck: [0, 10, 0] } }
    const out = addTurns(below, additive({ effectors: {}, fk: { neck: [0, 20, 0], head: [10, 0, 0] } }, 0.5))
    close(out.fk?.neck, [0, 20, 0])
    close(out.fk?.head, [5, 0, 0])
  })
  it('splits the chest, head and pelvis turns as the solver does', () => {
    const out = addTurns(
      { effectors: {} },
      additive(
        { effectors: { chest: { rot: [0, 10, 0] }, head: { rot: [10, 0, 0] }, pelvis: { rot: [0, 0, 4] } } },
        1,
      ),
    )
    close(out.fk?.spine, [0, 3, 0])
    close(out.fk?.chest, [0, 7, 0])
    close(out.fk?.neck, [4, 0, 0])
    close(out.fk?.head, [6, 0, 0])
    close(out.fk?.pelvis, [0, 0, 4])
    expect(out.effectors).toEqual({})
  })
  it('ignores positions, limb handles and poles', () => {
    const below: PoseDef = { effectors: { handR: { pos: [-0.2, 0.8, 0] } } }
    const out = addTurns(
      below,
      additive(
        {
          effectors: { handR: { pos: [0, 2, 0] }, pelvis: { pos: [0, 0.5, 0] } },
          poles: { elbowR: { dir: [0, 1, 0] } },
        },
        1,
      ),
    )
    expect(out).toEqual({ ...below, fk: {} })
  })
  it('composes as quaternions', () => {
    const out = addTurns(
      { effectors: {}, fk: { chest: [30, 0, 0] } },
      additive({ effectors: {}, fk: { chest: [0, 40, 0] } }, 1),
    )
    const expected = eulerOf(
      ((a, b) => [
        a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
        a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
        a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
        a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
      ])(eulerDegrees([30, 0, 0]), eulerDegrees([0, 40, 0])) as [number, number, number, number],
    ).map((r) => (r * 180) / Math.PI)
    close(out.fk?.chest, expected)
  })
})
