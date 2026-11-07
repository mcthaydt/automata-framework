// FigureBuilder's (mcthaydt/FigureBuilder) motion at a1f7246, fingerprinted (testing/__goldens__/
// figurebuilder-motion.json, written by scripts/figurebuilder-motion-goldens.ts): per joint, its world position
// and its rotation as a quaternion (testing/motion-fingerprint.ts), for `base()` and `evaluate()` on Wick's and
// the keeper's bodies in every fixture gait, every stand and every item's hold; `standHolds` on every golden
// outfit; and the hair spring's steps (`Figure.swingHair`). Twelve significant digits.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import type { M, V3 } from '../shared/math/math.ts'
import { type MotionFingerprint, motionFingerprint } from './motion-fingerprint.ts'

/** Per joint: [x, y, z, qx, qy, qz, qw] (testing/motion-fingerprint.ts). */
export type Digest = MotionFingerprint

export interface GoldenHold {
  readonly side: 'L' | 'R'
  readonly hand: V3
  readonly turn: V3
  readonly pole: V3
  readonly in?: number
  readonly aim?: [V3, V3]
  readonly anchor: string | null
}
export interface GoldenHairStep {
  readonly dt: number
  readonly moving: boolean
  readonly yawRate: number
  readonly phase: number
  readonly shown: number
  readonly head: M | null
  readonly before: { pitch: number; roll: number; vPitch: number; vRoll: number }
  readonly after: { pitch: number; roll: number; vPitch: number; vRoll: number }
}
export interface MotionGoldens {
  /** By body (`wick`, `keeper`), then `<gait> <state label>` or `stand <stand>`. */
  readonly bodies: Record<string, Record<string, Digest>>
  /** By `<golden outfit> <stand>`. */
  readonly stands: Record<string, { holds: GoldenHold[]; world: Digest }>
  /** By `<body> <item> <side> <state label>` (`GOLDEN_SOME_STATES`), in the strut gait. */
  readonly holds: Record<string, { hold: GoldenHold; world: Digest }>
  readonly hair: GoldenHairStep[]
}

export const MOTION_GOLDENS: MotionGoldens = JSON.parse(
  readFileSync(join(import.meta.dirname, '__goldens__/figurebuilder-motion.json'), 'utf8'),
) as MotionGoldens

/** Equal to 1e-9, relative past 1 (the goldens keep 12 significant digits). */
export function expectClose(actual: number, expected: number, what: string): void {
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(
    1e-9 * Math.max(1, Math.abs(expected)),
  )
}

/** A world pose against its golden fingerprint: each joint's position, and its rotation's quaternion (either sign). */
export function expectDigest(world: readonly M[], expected: Digest, what: string): void {
  const actual = motionFingerprint(world)
  expect(actual, what).toHaveLength(expected.length)
  for (const [j, want] of expected.entries()) {
    const got = actual[j] ?? []
    for (let c = 0; c < 3; c++)
      expectClose(got[c] ?? Number.NaN, want[c] ?? Number.NaN, `${what} joint ${j} position`)
    // q and −q are one rotation: compare against whichever sign is nearer.
    let same = 0
    let flipped = 0
    for (let c = 3; c < 7; c++) {
      same += Math.abs((got[c] ?? Number.NaN) - (want[c] ?? Number.NaN))
      flipped += Math.abs((got[c] ?? Number.NaN) + (want[c] ?? Number.NaN))
    }
    const sign = flipped < same ? -1 : 1
    for (let c = 3; c < 7; c++)
      expectClose(sign * (got[c] ?? Number.NaN), want[c] ?? Number.NaN, `${what} joint ${j} rotation`)
  }
}
