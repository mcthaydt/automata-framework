import { describe, expect, it } from 'vitest'
import type { TilesetDef } from '#src/shared/level-2d/model/project-types.ts'
import { tilesetTiles } from '#src/shared/level-2d/model/tileset-grid.ts'

const tileset = (patch: Partial<TilesetDef>): TilesetDef => ({
  id: 'terrain',
  label: 'Terrain',
  imageSize: { w: 128, h: 128 },
  tile: { w: 16, h: 16 },
  spacing: 0,
  padding: 0,
  tags: [],
  ...patch,
})

describe('tilesetTiles', () => {
  it('counts a 128 × 128 image of 16 px tiles as 8 × 8', () => {
    expect(tilesetTiles(tileset({}))).toEqual({ columns: 8, rows: 8, count: 64 })
  })

  it('leaves room for the spacing between tiles and the padding around the image', () => {
    // 1 px padding on each side leaves 126; a tile and its 2 px of spacing take 18, and the last tile needs no spacing
    // after it: (126 + 2) / 18 = 7.1, so 7 columns.
    expect(tilesetTiles(tileset({ spacing: 2, padding: 1 }))).toEqual({ columns: 7, rows: 7, count: 49 })
  })

  it('counts whole tiles only', () => {
    expect(tilesetTiles(tileset({ imageSize: { w: 100, h: 40 } }))).toEqual({
      columns: 6,
      rows: 2,
      count: 12,
    })
  })

  it('handles tiles that are not square', () => {
    expect(tilesetTiles(tileset({ imageSize: { w: 64, h: 96 }, tile: { w: 8, h: 32 } }))).toEqual({
      columns: 8,
      rows: 3,
      count: 24,
    })
  })

  it('is empty when the image is smaller than one tile', () => {
    expect(tilesetTiles(tileset({ imageSize: { w: 10, h: 128 } }))).toEqual({ columns: 0, rows: 8, count: 0 })
  })
})
