import { describe, expect, it } from 'vitest'
import { poseSchema } from '#src/features/figures/motion/pose.schema.ts'

/** The issues a parse fails with, as `path: message` lines. */
function issues(input: unknown): string[] {
  const result = poseSchema.safeParse(input)
  if (result.success) return []
  return result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

const full = {
  about: 'Every field a pose can set.',
  effectors: {
    footL: { pos: [0.1, 0.08, 0.3], rot: [0, 5, 0] },
    footR: { pos: [-0.1, 0.12, -0.35], rot: [40, 0, 0], weight: 0.5 },
    handL: { pos: [0.15, -0.23, 0.3], space: 'chest' },
    handR: { pos: [-0.16, 1.3, 0.52], rot: [-90, 0, 0], space: 'root' },
    pelvis: { pos: [0, 0.8, -0.02], rot: [0, 10, 0] },
    chest: { rot: [5, 0, 0] },
    head: { rot: [0, -10, 0], weight: 0.25 },
  },
  poles: { kneeL: { dir: [0, 0, 1] }, elbowR: { dir: [-0.6, -1, 0], space: 'chest' } },
  fk: { 'clavicle.L': [0, 0, 6], 'foot.R': [10, 0, 0], root: [0, 3, 0] },
  root: { pos: [0, 0, 0.1], yaw: 15 },
}

describe('poseSchema', () => {
  it('reads a pose that sets every field as it is written', () => {
    expect(poseSchema.parse(full)).toEqual(full)
  })
  it('reads an empty pose: a pose names only what it sets', () => {
    expect(poseSchema.parse({ effectors: {} })).toEqual({ effectors: {} })
  })
  it('refuses a handle, a pole or a joint the rig does not have, at its key', () => {
    expect(issues({ effectors: { handC: { pos: [0, 1, 0] } } })).toEqual([
      expect.stringMatching(/^effectors: .*handC/),
    ])
    expect(issues({ effectors: {}, poles: { wristL: { dir: [0, 0, 1] } } })).toEqual([
      expect.stringMatching(/^poles: .*wristL/),
    ])
    expect(issues({ effectors: {}, fk: { 'toe.L': [0, 0, 0] } })).toEqual([
      expect.stringMatching(/^fk: .*toe\.L/),
    ])
  })
  it('refuses a position on the chest or the head, and a space on the pelvis', () => {
    expect(issues({ effectors: { chest: { pos: [0, 1, 0] } } })).toEqual([
      expect.stringMatching(/^effectors\.chest: .*pos/),
    ])
    expect(issues({ effectors: { head: { pos: [0, 1, 0] } } })).toEqual([
      expect.stringMatching(/^effectors\.head: .*pos/),
    ])
    expect(issues({ effectors: { pelvis: { pos: [0, 1, 0], space: 'chest' } } })).toEqual([
      expect.stringMatching(/^effectors\.pelvis: .*space/),
    ])
  })
  it('refuses a weight outside 0 to 1', () => {
    expect(issues({ effectors: { handL: { pos: [0, 1, 0], weight: 1.5 } } })).toEqual([
      expect.stringMatching(/^effectors\.handL\.weight: /),
    ])
  })
  it('refuses a number that is not finite, naming the value', () => {
    expect(issues({ effectors: { handL: { pos: [0, Number.NaN, 0] } } })).toEqual([
      'effectors.handL.pos.1: NaN is not a finite number',
    ])
    expect(issues({ effectors: {}, fk: { 'hand.R': [Number.POSITIVE_INFINITY, 0, 0] } })).toEqual([
      'fk.hand.R.0: Infinity is not a finite number',
    ])
    expect(issues({ effectors: {}, root: { yaw: Number.NEGATIVE_INFINITY } })).toEqual([
      'root.yaw: -Infinity is not a finite number',
    ])
  })
  it("refuses a position past twice the reference figure's reach, naming the field and the value", () => {
    expect(issues({ effectors: { handR: { pos: [0, 9, 0] } } })).toEqual([
      expect.stringMatching(/^effectors\.handR\.pos: \[0, 9, 0\] is 9 figure units from the root/),
    ])
  })
})
