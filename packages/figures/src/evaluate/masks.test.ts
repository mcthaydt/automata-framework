import { describe, expect, it } from 'vitest'
import { MASK_GROUPS } from '../clip/clip.schema'
import type { PoseDef } from '../pose/pose.schema'
import { maskPose, movesLegs, ownsArm } from './masks'

/** A pose naming a channel of every group. */
const EVERY: PoseDef = {
  effectors: {
    pelvis: { pos: [0, 0.8, 0] },
    chest: { rot: [5, 0, 0] },
    head: { rot: [0, 10, 0] },
    handL: { pos: [0.1, 1.3, 0.2] },
    handR: { pos: [-0.1, 1.3, 0.2] },
    footL: { pos: [0.1, 0.08, 0] },
    footR: { pos: [-0.1, 0.08, 0] },
  },
  poles: {
    elbowL: { dir: [1, -1, 0] },
    elbowR: { dir: [-1, -1, 0] },
    kneeL: { dir: [0, 0, 1] },
    kneeR: { dir: [0, 0, 1] },
  },
  fk: {
    root: [0, 1, 0],
    pelvis: [1, 0, 0],
    spine: [2, 0, 0],
    chest: [3, 0, 0],
    neck: [4, 0, 0],
    head: [5, 0, 0],
    'hair.back': [6, 0, 0],
    'clavicle.L': [0, 0, 6],
    'hand.L': [7, 0, 0],
    'clavicle.R': [0, 0, -6],
    'foreArm.R': [8, 0, 0],
    'thigh.L': [9, 0, 0],
    hemL: [10, 0, 0],
    'shin.R': [11, 0, 0],
  },
  root: { pos: [0, 0, 0.1], yaw: 15 },
}

describe('maskPose', () => {
  it('keeps exactly the channels each group owns', () => {
    expect(maskPose(EVERY, ['root'])).toEqual({
      effectors: {},
      poles: {},
      fk: { root: [0, 1, 0] },
      root: EVERY.root,
    })
    expect(maskPose(EVERY, ['pelvis'])).toEqual({
      effectors: { pelvis: { pos: [0, 0.8, 0] } },
      poles: {},
      fk: { pelvis: [1, 0, 0] },
    })
    expect(maskPose(EVERY, ['torso'])).toEqual({
      effectors: { chest: { rot: [5, 0, 0] } },
      poles: {},
      fk: { spine: [2, 0, 0], chest: [3, 0, 0] },
    })
    expect(maskPose(EVERY, ['head'])).toEqual({
      effectors: { head: { rot: [0, 10, 0] } },
      poles: {},
      fk: { neck: [4, 0, 0], head: [5, 0, 0], 'hair.back': [6, 0, 0] },
    })
    expect(maskPose(EVERY, ['armL'])).toEqual({
      effectors: { handL: { pos: [0.1, 1.3, 0.2] } },
      poles: { elbowL: { dir: [1, -1, 0] } },
      fk: { 'clavicle.L': [0, 0, 6], 'hand.L': [7, 0, 0] },
    })
    expect(maskPose(EVERY, ['armR'])).toEqual({
      effectors: { handR: { pos: [-0.1, 1.3, 0.2] } },
      poles: { elbowR: { dir: [-1, -1, 0] } },
      fk: { 'clavicle.R': [0, 0, -6], 'foreArm.R': [8, 0, 0] },
    })
    expect(maskPose(EVERY, ['legL'])).toEqual({
      effectors: { footL: { pos: [0.1, 0.08, 0] } },
      poles: { kneeL: { dir: [0, 0, 1] } },
      fk: { 'thigh.L': [9, 0, 0], hemL: [10, 0, 0] },
    })
    expect(maskPose(EVERY, ['legR'])).toEqual({
      effectors: { footR: { pos: [-0.1, 0.08, 0] } },
      poles: { kneeR: { dir: [0, 0, 1] } },
      fk: { 'shin.R': [11, 0, 0] },
    })
  })
  it('keeps every channel under every group, and none under no group', () => {
    const all = maskPose(EVERY, MASK_GROUPS)
    expect(all).toEqual({ effectors: EVERY.effectors, poles: EVERY.poles, fk: EVERY.fk, root: EVERY.root })
    expect(maskPose(EVERY, [])).toEqual({ effectors: {}, poles: {}, fk: {} })
  })
  it('drops the about text', () => {
    expect(maskPose({ about: 'a note', effectors: {} }, MASK_GROUPS)).toEqual({
      effectors: {},
      poles: {},
      fk: {},
    })
  })
})

describe('ownsArm and movesLegs', () => {
  it('reads an arm from the mask', () => {
    expect(ownsArm(['armR', 'torso'], 'R')).toBe(true)
    expect(ownsArm(['armR', 'torso'], 'L')).toBe(false)
  })
  it('says whether a pose moves the hips or a leg', () => {
    expect(movesLegs(maskPose(EVERY, ['armL', 'armR', 'torso', 'head']))).toBe(false)
    expect(movesLegs({ effectors: { pelvis: { rot: [0, 5, 0] } } })).toBe(true)
    expect(movesLegs({ effectors: { pelvis: { pos: [0, 0.7, 0] } } })).toBe(true)
    expect(movesLegs({ effectors: { footR: { pos: [0, 0.1, 0] } } })).toBe(true)
    expect(movesLegs({ effectors: {}, poles: { kneeL: { dir: [0, 0, 1] } } })).toBe(true)
    expect(movesLegs({ effectors: {}, fk: { 'shin.R': [5, 0, 0] } })).toBe(true)
    expect(movesLegs({ effectors: {}, fk: { pelvis: [5, 0, 0] } })).toBe(true)
    expect(movesLegs({ effectors: {}, root: { yaw: 10 } })).toBe(true)
  })
})
