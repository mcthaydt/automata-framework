import { describe, expect, it } from 'vitest'
import {
  ATLAS_EXTRUDE,
  ATLAS_PADDING,
  ATLAS_PAGE_MAX,
  AtlasFrameTooLarge,
  packFrames,
} from '#src/assets/atlas-pack.ts'

// The deterministic atlas packer (M5 spec §4.7, M5-D8): frames in code-unit order, on shelves, each with 1 px of
// edge extrusion and 1 px of padding, on the smallest square power-of-two page up to 2048, then more pages.

const frame = (name: string, width = 16, height = 16) => ({ name, width, height })

describe('packFrames', () => {
  it('uses 1 px padding and 1 px extrusion, on pages no larger than 2048', () => {
    expect([ATLAS_PADDING, ATLAS_EXTRUDE, ATLAS_PAGE_MAX]).toEqual([1, 1, 2048])
  })

  it('places frames in code-unit order of their names, whatever order they came in', () => {
    const packed = packFrames([frame('run-b'), frame('Idle'), frame('run-a')])
    expect(packed.placements.map((placement) => placement.name)).toEqual(['Idle', 'run-a', 'run-b'])
  })

  it('puts one frame inside its padding and extrusion, on the smallest page that holds it', () => {
    expect(packFrames([frame('a')])).toEqual({
      pageSizes: [32],
      placements: [{ name: 'a', page: 0, x: 2, y: 2, width: 16, height: 16 }],
    })
  })

  it('spaces frames on a shelf by the frame, both extrusions and the padding', () => {
    const { placements } = packFrames([frame('a'), frame('b')])
    expect(placements[1]).toMatchObject({ x: 2 + 16 + 2 + 1, y: 2 })
  })

  it('starts a new shelf below the tallest cell of the last one', () => {
    // On a 32 page a second 16-wide frame cannot fit beside the first (2 + 18 + 1 + 18 > 32), so the page grows.
    const tall = packFrames([frame('a', 16, 30), frame('b', 16, 16), frame('c', 40, 8)])
    expect(tall.pageSizes).toEqual([64])
    expect(tall.placements).toEqual([
      { name: 'a', page: 0, x: 2, y: 2, width: 16, height: 30 },
      { name: 'b', page: 0, x: 21, y: 2, width: 16, height: 16 },
      { name: 'c', page: 0, x: 2, y: 1 + 32 + 1 + 1, width: 40, height: 8 },
    ])
  })

  it('grows the page by powers of two until everything fits on one', () => {
    const frames = Array.from({ length: 20 }, (_, index) => frame(`f${String(index).padStart(2, '0')}`))
    expect(packFrames(frames).pageSizes).toEqual([128])
  })

  it('spills onto more 2048 pages when one page cannot hold them all', () => {
    const frames = Array.from({ length: 300 }, (_, index) =>
      frame(`f${String(index).padStart(3, '0')}`, 200, 200),
    )
    const packed = packFrames(frames)
    // 2048 holds 10 cells of 203 a shelf (1 + 10 × 203 = 2031), and 10 shelves: 100 a page.
    expect(packed.pageSizes).toEqual([2048, 2048, 2048])
    expect(packed.placements[99]).toMatchObject({ page: 0 })
    expect(packed.placements[100]).toMatchObject({ page: 1, x: 2, y: 2 })
    for (const placement of packed.placements) {
      expect(placement.x + placement.width + ATLAS_EXTRUDE).toBeLessThanOrEqual(2048)
      expect(placement.y + placement.height + ATLAS_EXTRUDE).toBeLessThanOrEqual(2048)
    }
  })

  it('refuses a frame that cannot fit a page with its padding and extrusion, naming it', () => {
    expect(() => packFrames([frame('ok'), frame('banner', 2046, 8)])).toThrow(AtlasFrameTooLarge)
    expect(() => packFrames([frame('banner', 2046, 8)])).toThrow(/banner/)
    expect(packFrames([frame('fits', 2045, 8)]).pageSizes).toEqual([2048])
  })

  it('gives an empty atlas for no frames', () => {
    expect(packFrames([])).toEqual({ pageSizes: [], placements: [] })
  })
})
