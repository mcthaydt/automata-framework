import { describe, expect, it } from 'vitest'
import { FACING_HOLD_DEG, holdFacing } from '#src/features/painted/facing-hold.ts'

// The painter draws the nearest of 8 directions to the figure's bearing from the camera. Under a camera the player turns
// freely, a bearing that sits on a boundary (22.5° off a direction) would flip the drawing every frame the camera or the
// figure wobbles across it; the hold keeps the direction drawn until the bearing is past the boundary by a margin.
const DEG = Math.PI / 180
/** The direction the painter draws for a facing and an azimuth: its own rule (`Figure.snap`). */
const drawn = (facing: number, azimuth: number): number => {
  const rel = Math.atan2(Math.sin(facing - azimuth), Math.cos(facing - azimuth))
  return ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8
}

describe('holdFacing', () => {
  it('draws the nearest direction when nothing is held', () => {
    const { eighth, facing } = holdFacing(40 * DEG, 0, undefined)
    expect(eighth).toBe(1)
    expect(drawn(facing, 0)).toBe(1)
  })

  it('keeps the held direction across the boundary until the bearing is past it by the margin', () => {
    expect(FACING_HOLD_DEG).toBeGreaterThan(0)
    // Held at 0; the bearing creeps past 22.5° but not past 22.5° plus the margin: still 0.
    const near = holdFacing((22.5 + FACING_HOLD_DEG - 1) * DEG, 0, 0)
    expect(near.eighth).toBe(0)
    expect(drawn(near.facing, 0)).toBe(0)
    // Past it: the next direction.
    const past = holdFacing((22.5 + FACING_HOLD_DEG + 1) * DEG, 0, 0)
    expect(past.eighth).toBe(1)
  })

  it('does not flicker as a camera wobbles across a boundary', () => {
    let held: number | undefined
    const seen: number[] = []
    for (let frame = 0; frame < 40; frame++) {
      // The camera's azimuth wobbles ±3° about the bearing's boundary at 22.5°.
      const azimuth = (frame % 2 === 0 ? 3 : -3) * DEG
      const out = holdFacing(22.5 * DEG, azimuth, held)
      held = out.eighth
      seen.push(drawn(out.facing, azimuth))
    }
    expect(new Set(seen).size).toBe(1)
  })

  it('wraps: a held 7 and a bearing just past 0 are neighbours, not 7 apart', () => {
    expect(holdFacing(5 * DEG, 0, 7).eighth).toBe(0)
    expect(holdFacing(-28 * DEG, 0, 0).eighth).toBe(0)
    expect(holdFacing(-25 * DEG, 0, 7).eighth).toBe(7)
    expect(holdFacing(-35 * DEG, 0, 0).eighth).toBe(7)
  })
})
