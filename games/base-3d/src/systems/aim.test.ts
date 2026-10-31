// The ranged aim under the angled camera (DESIGN.md §9.2 option C): a plan direction and a target pick, on integers.
import { describe, expect, it } from 'vitest'
import { metres } from '../constants/index.ts'
import { CHEST_HEIGHT } from '../constants/items.ts'
import { aimDirection, pickTarget } from './aim.ts'

const QUARTER = 16_384
const wick = { x: 0, z: 0, facing: QUARTER }

describe('aimDirection', () => {
  it('aims at the locked target first', () => {
    expect(aimDirection(wick, { x: 0, z: metres(5) }, { x: 127, y: 0 }, 0)).toBe(0)
  })
  it('else along the stick, through the heading, as the walk maps it', () => {
    expect(aimDirection(wick, undefined, { x: 0, y: -127 }, QUARTER)).toBe(QUARTER)
    expect(aimDirection(wick, undefined, { x: 0, y: -127 }, 0)).toBe(0)
  })
  it('else along his facing', () => {
    expect(aimDirection(wick, undefined, { x: 0, y: 0 }, 0)).toBe(QUARTER)
  })
})

describe('pickTarget', () => {
  const foe = (id: number, x: number, z: number, lift = 0, height = 1.8) => ({
    id,
    x: metres(x),
    z: metres(z),
    lift: metres(lift),
    height: metres(height),
  })

  it('picks the nearest foe within ±6° of the aim and 15 m, toward it in plan, at its hurt cylinder’s middle', () => {
    const picked = pickTarget(wick, 0, [foe(4, 0, 9), foe(3, 0.5, 6, 2.2, 0.8)])
    // Its bearing, atan2(0.5, 6): 4.76°, 867 turn units off the aim, so the shot meets it.
    expect(picked).toEqual({ id: 3, y: metres(2.2) + metres(0.4), facing: 867 })
  })
  it('leaves out a foe outside ±6°, or past 15 m', () => {
    // 10 m ahead and 1.2 m aside is 6.8° off the line.
    expect(pickTarget(wick, 0, [foe(2, 1.2, 10)])).toBeUndefined()
    expect(pickTarget(wick, 0, [foe(2, 0, 15.5)])).toBeUndefined()
    expect(pickTarget(wick, 0, [foe(2, 1, 10)])?.id).toBe(2)
  })
  it('breaks a tie of distance by the lower id', () => {
    expect(pickTarget(wick, 0, [foe(7, 0.3, 4), foe(5, -0.3, 4)])?.id).toBe(5)
  })
  it('flies level at chest height with nothing to pick', () => {
    expect(CHEST_HEIGHT).toBe(metres(1.2))
  })
})
