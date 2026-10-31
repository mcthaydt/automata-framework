// Shake and sparks (DESIGN.md §7.6): presentation from `hit.landed`, never read by the sim.
import { describe, expect, it } from 'vitest'
import { type FeltHit, SHAKE_MS, SPARK_COLOURS, shakeOffset, sparkFrame } from './feel.ts'

const hit = (power: number, startMs = 0, kind: FeltHit['kind'] = 'hit'): FeltHit => ({
  power,
  kind,
  at: { x: 0, z: 0 },
  startMs,
})
const size = (offset: { x: number; y: number }) => Math.max(Math.abs(offset.x), Math.abs(offset.y))

describe('shakeOffset', () => {
  it('shakes 1, 2 and 4 internal pixels for power 1, 2 and 3 as the hit lands', () => {
    expect(size(shakeOffset([hit(1)], 0, false))).toBe(1)
    expect(size(shakeOffset([hit(2)], 0, false))).toBe(2)
    expect(size(shakeOffset([hit(3)], 0, false))).toBe(4)
  })

  it('takes the largest live shake, decays it and stops at 120 ms', () => {
    expect(size(shakeOffset([hit(1), hit(3)], 0, false))).toBe(4)
    expect(size(shakeOffset([hit(3)], SHAKE_MS / 2, false))).toBeCloseTo(2, 5)
    expect(shakeOffset([hit(3)], SHAKE_MS, false)).toEqual({ x: 0, y: 0 })
  })

  it('does not shake under reduced motion', () => {
    expect(shakeOffset([hit(3)], 0, true)).toEqual({ x: 0, y: 0 })
  })
})

describe('sparkFrame', () => {
  it('spreads and fades over 150 ms, in the kind’s colour', () => {
    expect(sparkFrame(hit(1), 0, false)).toEqual({ spread: 0, alpha: 1, colour: SPARK_COLOURS.hit })
    expect(sparkFrame(hit(1), 75, false)).toMatchObject({ alpha: 0.5 })
    expect(sparkFrame(hit(1), 150, false)).toBeUndefined()
    expect(sparkFrame(hit(1, 0, 'parry'), 0, false)?.colour).toBe(SPARK_COLOURS.parry)
  })

  it('is shortened to 75 ms under reduced motion', () => {
    expect(sparkFrame(hit(1), 74, true)).toBeDefined()
    expect(sparkFrame(hit(1), 75, true)).toBeUndefined()
  })
})
