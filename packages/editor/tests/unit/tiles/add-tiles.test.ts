import { describe, expect, test } from 'vitest'
import { pictureAsset, tileGrid, tilesetFromPicture } from '#src/features/tiles/add-tiles.ts'
import { tilesetTiles } from '#src/shared/level-2d/model/tileset-grid.ts'

// Add tiles (plan 12.3b): a picture and one tile size give the grid, the words the dialog shows, the file to write
// and the tileset to add. Pure; the dialog only draws this.

describe('tileGrid', () => {
  test('counts the tiles a picture holds and says so in words', () => {
    const grid = tileGrid({ w: 128, h: 128 }, 16)
    expect(grid).toMatchObject({ columns: 8, rows: 8, count: 64, problem: undefined })
    expect(grid.summary).toBe('This makes 64 tiles.')
  })

  test('one tile is one tile, not "1 tiles"', () => {
    expect(tileGrid({ w: 16, h: 16 }, 16).summary).toBe('This makes 1 tile.')
  })

  test('a size that leaves pixels over says how many and suggests the two nearest sizes that fit both sides', () => {
    const grid = tileGrid({ w: 100, h: 100 }, 16)
    expect(grid.problem).toBe('The picture is 100 px wide; 16 px tiles leave 4 px over. Try 10 or 20.')
    expect(grid.summary).toBeUndefined()
  })

  test('the height is checked when the width fits', () => {
    expect(tileGrid({ w: 64, h: 40 }, 16).problem).toBe(
      'The picture is 40 px high; 16 px tiles leave 8 px over. Try 8.',
    )
  })

  test('a tile bigger than the picture says so', () => {
    expect(tileGrid({ w: 32, h: 32 }, 48).problem).toBe(
      'The picture is 32 px wide, smaller than one 48 px tile.',
    )
  })

  test('with no size that fits, it suggests nothing', () => {
    expect(tileGrid({ w: 37, h: 37 }, 16).problem).toBe(
      'The picture is 37 px wide; 16 px tiles leave 5 px over.',
    )
  })
})

describe('pictureAsset', () => {
  test('puts the picture under assets/ with a plain name and its own extension', () => {
    expect(pictureAsset('Forest Tiles (v2).PNG', [])).toBe('assets/forest-tiles-v2.png')
  })

  test('never replaces a file that is there: a number is added', () => {
    expect(pictureAsset('grass.webp', ['assets/grass.webp', 'assets/grass-2.webp'])).toBe(
      'assets/grass-3.webp',
    )
  })

  test('a name with nothing usable in it becomes "tiles"', () => {
    expect(pictureAsset('???.jpeg', [])).toBe('assets/tiles.jpeg')
  })
})

describe('tilesetFromPicture', () => {
  test('makes a tileset named after the picture in words, with a fresh id and no tags', () => {
    const def = tilesetFromPicture({
      fileName: 'forest-tiles.png',
      path: 'assets/forest-tiles.png',
      size: { w: 128, h: 64 },
      tile: 16,
      taken: ['forest-tiles'],
    })
    expect(def).toEqual({
      id: 'forest-tiles-2',
      label: 'Forest tiles',
      image: 'assets/forest-tiles.png',
      imageSize: { w: 128, h: 64 },
      tile: { w: 16, h: 16 },
      spacing: 0,
      padding: 0,
      tags: [],
    })
    expect(tilesetTiles(def).count).toBe(32)
  })
})
