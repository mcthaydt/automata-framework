// FigureBuilder's (mcthaydt/FigureBuilder) motion at a1f7246, fingerprinted (testing/__goldens__/
// figurebuilder-motion.json, M3.5c plan step 2): per joint, its world position weighted 1, 2, 3 and its
// rotation's nine entries weighted 1 to 9, for `base()` and `evaluate()` on Wick's and the keeper's bodies in
// every fixture gait, every stand and every item's hold; `standHolds` on every golden outfit; and the hair
// spring's steps (`Figure.swingHair`).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import type { M, V3 } from '../math/math'

export type Digest = [position: number, rotation: number][]

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
  /** By `<body> <item> <side> <state label>`, in the strut gait. */
  readonly holds: Record<string, { hold: GoldenHold; world: Digest }>
  readonly hair: GoldenHairStep[]
}

export const MOTION_GOLDENS: MotionGoldens = JSON.parse(
  readFileSync(join(import.meta.dirname, '__goldens__/figurebuilder-motion.json'), 'utf8'),
) as MotionGoldens

export function digest(world: readonly M[]): Digest {
  return world.map((m) => {
    let rotation = 0
    for (let i = 0; i < 9; i++) rotation += (i + 1) * (m[i] ?? Number.NaN)
    return [m[9] + 2 * m[10] + 3 * m[11], rotation]
  })
}

/** Equal to 1e-9, relative past 1 (the goldens keep 13 significant digits). */
export function expectClose(actual: number, expected: number, what: string): void {
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(
    1e-9 * Math.max(1, Math.abs(expected)),
  )
}

export function expectDigest(world: readonly M[], expected: Digest, what: string): void {
  const actual = digest(world)
  expect(actual, what).toHaveLength(expected.length)
  for (const [j, [position, rotation]] of expected.entries()) {
    const [p, r] = actual[j] ?? [Number.NaN, Number.NaN]
    expectClose(p, position, `${what} joint ${j} position`)
    expectClose(r, rotation, `${what} joint ${j} rotation`)
  }
}
