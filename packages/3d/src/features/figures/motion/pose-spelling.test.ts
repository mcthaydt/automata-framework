import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { randomPose } from '../../../testing/random-poses.ts'
import { poseSchema } from './pose.schema.ts'
import { canonicalPose, printPose, roundPoseNumber } from './pose-spelling.ts'

const readBack = (text: string) => poseSchema.parse(parse(text))

describe('roundPoseNumber', () => {
  it('keeps 4 decimals, rounding in decimal notation as the number reads', () => {
    expect(roundPoseNumber(0.1 + 0.2)).toBe(0.3)
    // 1.00005 is 1.0000499999… in binary: rounding the binary value would give 1.
    expect(roundPoseNumber(1.00005)).toBe(1.0001)
    expect(roundPoseNumber(12.3456789)).toBe(12.3457)
    expect(roundPoseNumber(-0.33333)).toBe(-0.3333)
    expect(roundPoseNumber(1e-7)).toBe(0)
  })
  it('never gives -0', () => {
    expect(Object.is(roundPoseNumber(-0.00001), 0)).toBe(true)
    expect(Object.is(roundPoseNumber(-0), 0)).toBe(true)
  })
})

describe('canonicalPose', () => {
  it('rounds every number, leaves out defaults and empty parts, and orders the keys', () => {
    const pose = canonicalPose({
      root: {},
      fk: { 'hand.R': [0.123456, 0, 0], 'clavicle.L': [0, 0, 6] },
      poles: {},
      effectors: {
        head: { weight: 1, rot: [0, -10, 0] },
        handR: { weight: 1, space: 'root', rot: [-90, 0, 0], pos: [-0.16, 1.3, 0.52] },
        handL: { space: 'chest', pos: [0.1, 0.2, 0.3] },
        footL: {},
      },
    })
    expect(pose).toEqual({
      effectors: {
        handL: { pos: [0.1, 0.2, 0.3], space: 'chest' },
        handR: { pos: [-0.16, 1.3, 0.52], rot: [-90, 0, 0] },
        head: { rot: [0, -10, 0] },
      },
      fk: { 'clavicle.L': [0, 0, 6], 'hand.R': [0.1235, 0, 0] },
    })
    expect(Object.keys(pose.effectors)).toEqual(['handL', 'handR', 'head'])
    expect(Object.keys(pose.effectors.handR ?? {})).toEqual(['pos', 'rot'])
    expect(Object.keys(pose.fk ?? {})).toEqual(['clavicle.L', 'hand.R'])
  })
})

describe('printPose', () => {
  it('writes the canonical pose as TOML, one table per handle', () => {
    const text = printPose({
      about: 'A point.',
      effectors: { head: { rot: [0, -10, 0] }, handR: { pos: [-0.16, 1.3, 0.520001], rot: [-90, 0, 0] } },
      fk: { 'clavicle.R': [0, 0, -6] },
      root: { yaw: 15 },
    })
    expect(text).toBe(
      [
        'about = "A point."',
        '',
        '[effectors.handR]',
        'pos = [ -0.16, 1.3, 0.52 ]',
        'rot = [ -90, 0, 0 ]',
        '',
        '[effectors.head]',
        'rot = [ 0, -10, 0 ]',
        '',
        '[fk]',
        '"clavicle.R" = [ 0, 0, -6 ]',
        '',
        '[root]',
        'yaw = 15',
        '',
      ].join('\n'),
    )
  })
  it('writes an empty pose with its empty effectors table', () => {
    expect(readBack(printPose({ effectors: {} }))).toEqual({ effectors: {} })
  })
  it('reads back as the canonical pose, and prints again byte for byte (200 seeded poses)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const pose = randomPose(seed)
      const text = printPose(pose)
      const back = readBack(text)
      expect(back).toEqual(canonicalPose(pose))
      expect(printPose(back)).toBe(text)
    }
  })
})
