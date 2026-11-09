import { describe, expect, it } from 'vitest'
import { tileScales } from '#src/features/photo/tile-scales.ts'

// The Owner's lens: the field shows one metre of the scene a metre away, so a pixel a metre is the short side over the distance.
const LENS = 2 * Math.atan(0.5)

describe('the tile scales of a view', () => {
  it('takes the floor and wall pairs from the view', () => {
    expect(tileScales({ distance: 5, tiltDeg: 25 }, 360, LENS)).toEqual({ floor: [64, 32], wall: [64, 64] })
  })

  it('shows a nearer view in more texels a metre, and a steeper one a floor with more depth', () => {
    const near = tileScales({ distance: 2.5, tiltDeg: 25 }, 360, LENS)
    expect(near.floor[0]).toBeGreaterThan(64)
    const top = tileScales({ distance: 5, tiltDeg: 80 }, 360, LENS)
    expect(top.floor[1]).toBeGreaterThan(tileScales({ distance: 5, tiltDeg: 25 }, 360, LENS).floor[1])
    expect(top.wall[1]).toBeLessThan(tileScales({ distance: 5, tiltDeg: 25 }, 360, LENS).wall[1])
  })

  it('stays inside the pipeline’s 3 to 200 texels a metre', () => {
    const far = tileScales({ distance: 4000, tiltDeg: 0 }, 360, LENS)
    expect(far.floor[1]).toBe(3)
    const close = tileScales({ distance: 0.05, tiltDeg: 45 }, 360, LENS)
    expect(close.wall[0]).toBe(200)
  })
})
