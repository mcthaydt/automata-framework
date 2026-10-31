// The hit test's plan geometry (DESIGN.md §7.3, §7.4): integers only, so a hit lands on the same tick in every engine.
import { describe, expect, it } from 'vitest'
import { metres } from '../constants/index.ts'
import { coneHits, facingVector, inArc, reachHits } from './combat-geometry.ts'

const QUARTER = 16_384

describe('facingVector', () => {
  it('is the facing as a Q12 direction: 0 toward +z, a quarter toward +x', () => {
    expect(facingVector(0)).toEqual({ x: 0, z: 4096 })
    expect(facingVector(QUARTER)).toEqual({ x: 4096, z: 0 })
    expect(facingVector(2 * QUARTER)).toEqual({ x: 0, z: -4096 })
    expect(facingVector(3 * QUARTER)).toEqual({ x: -4096, z: 0 })
  })
})

describe('reachHits', () => {
  // Wick at the origin facing +z, a reach from 0.2 m to 1.2 m, against a 0.4 m cylinder.
  const reach = { near: metres(0.2), far: metres(1.2) }
  const hits = (x: number, z: number, facing = 0) =>
    reachHits({ x: 0, z: 0 }, facingVector(facing), reach, { x: metres(x), z: metres(z) }, metres(0.4))

  it('lands on a cylinder straight ahead inside the band, and on one whose edge reaches it', () => {
    expect(hits(0, 1)).toBe(true)
    expect(hits(0, 1.6)).toBe(true)
    expect(hits(0.35, 0.8)).toBe(true)
  })

  it('misses past the far end, beside the segment, and behind', () => {
    expect(hits(0, 1.65)).toBe(false)
    expect(hits(0.45, 0.8)).toBe(false)
    expect(hits(0, -0.5)).toBe(false)
  })

  it('turns with the facing', () => {
    expect(hits(1, 0, QUARTER)).toBe(true)
    expect(hits(0, 1, QUARTER)).toBe(false)
  })
})

describe('inArc', () => {
  // The shield's 120° arc: ±60° (10,923 turn units) around the facing.
  const HALF = 10_923
  const deg = (d: number) => Math.round((d * 65_536) / 360)

  it('holds a bearing within 60° either side, and nothing past it or behind', () => {
    expect(inArc(0, deg(60), HALF)).toBe(true)
    expect(inArc(0, deg(-60), HALF)).toBe(true)
    expect(inArc(0, deg(61), HALF)).toBe(false)
    expect(inArc(0, deg(180), HALF)).toBe(false)
  })

  it('wraps through 0', () => {
    expect(inArc(deg(350), deg(20), HALF)).toBe(true)
  })
})

describe('coneHits (the Warden’s breath, DESIGN.md §8.4)', () => {
  // 70° wide, so ±35° (6,372 turn units), and 5 m long, from the origin facing +z.
  const HALF = 6_372
  const from = { x: 0, z: 0 }
  it('reaches a cylinder ahead within its length and its half-angle', () => {
    expect(coneHits(from, 0, metres(5), HALF, { x: 0, z: metres(4.5) }, metres(0.3))).toBe(true)
    expect(coneHits(from, 0, metres(5), HALF, { x: metres(2), z: metres(3.5) }, metres(0.3))).toBe(true)
  })
  it('misses one past its length, outside its angle, or behind', () => {
    expect(coneHits(from, 0, metres(5), HALF, { x: 0, z: metres(5.5) }, metres(0.3))).toBe(false)
    expect(coneHits(from, 0, metres(5), HALF, { x: metres(3), z: metres(3) }, metres(0.3))).toBe(false)
    expect(coneHits(from, 0, metres(5), HALF, { x: 0, z: metres(-2) }, metres(0.3))).toBe(false)
  })
})
