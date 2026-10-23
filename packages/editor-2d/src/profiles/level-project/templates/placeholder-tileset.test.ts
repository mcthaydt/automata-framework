import { describe, expect, it } from 'vitest'
import { tilesetTiles } from '../../../model/tileset-grid'
import { placeholderTileset } from './placeholder-tileset'

describe('placeholderTileset', () => {
  const set = placeholderTileset({
    id: 'terrain',
    label: 'Terrain',
    columns: 8,
    rows: 4,
    tile: 16,
    tags: [{ tag: 'solid', tiles: [0, 1] }],
  })

  it('has no image, so it is a placeholder that real art replaces by one import', () => {
    expect(set.image).toBeUndefined()
    expect(set.label).toBe('Terrain (placeholder)')
  })

  it('is as large as the image that would replace it, with square tiles and no spacing', () => {
    expect(set.imageSize).toEqual({ w: 128, h: 64 })
    expect(set.tile).toEqual({ w: 16, h: 16 })
    expect([set.spacing, set.padding]).toEqual([0, 0])
    expect(tilesetTiles(set)).toEqual({ columns: 8, rows: 4, count: 32 })
  })

  it('carries the tags it is given', () => {
    expect(set.tags).toEqual([{ tag: 'solid', tiles: [0, 1] }])
  })
})
