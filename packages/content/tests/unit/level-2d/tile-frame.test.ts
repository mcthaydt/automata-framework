import { describe, expect, it } from 'vitest'
import type { ContentEntityDef, ContentTileset } from '#src/shared/level-2d/content.schema.ts'
import { pictureOf } from '#src/shared/level-2d/picture-of.ts'
import { PLACEHOLDER_COLORS, placeholderColor, tileFrame } from '#src/shared/level-2d/tile-frame.ts'

const set = (over: Partial<ContentTileset> = {}): ContentTileset => ({
  id: 'terrain',
  tile: { w: 16, h: 16 },
  columns: 4,
  rows: 4,
  spacing: 2,
  padding: 1,
  placeholder: false,
  tags: [],
  ...over,
})

describe('tileFrame', () => {
  it('counts padding once and spacing between tiles', () => {
    expect(tileFrame(set(), 5)).toEqual({ x: 19, y: 19, w: 16, h: 16 })
    expect(tileFrame(set(), 0)).toEqual({ x: 1, y: 1, w: 16, h: 16 })
  })

  it('is undefined past the set', () => {
    expect(tileFrame(set(), 15)).toBeDefined()
    expect(tileFrame(set(), 16)).toBeUndefined()
  })
})

describe('placeholderColor', () => {
  it('takes colour n % 12', () => {
    expect(PLACEHOLDER_COLORS).toHaveLength(12)
    expect(placeholderColor(13)).toBe('#5a7d8a')
    expect(placeholderColor(0)).toBe(PLACEHOLDER_COLORS[0])
  })
})

const def = (over: Partial<ContentEntityDef> = {}): ContentEntityDef => ({
  id: 'coin',
  fields: [],
  shape: 'ellipse',
  size: { w: 8, h: 8 },
  pivot: { x: 0.5, y: 0.5 },
  resizable: 'none',
  tags: [],
  ...over,
})

describe('pictureOf', () => {
  it('is the tile only when the shape is tile', () => {
    const tile = { tileset: 'terrain', index: 3 }
    expect(pictureOf(def({ shape: 'tile', tile }))).toEqual({ kind: 'tile', tileset: 'terrain', index: 3 })
    expect(pictureOf(def({ shape: 'rect', tile }))).toMatchObject({ kind: 'flat', shape: 'rect' })
  })

  it('is the flat shape in the definition colour, with the editor default', () => {
    expect(pictureOf(def({ color: '#facc15' }))).toEqual({ kind: 'flat', shape: 'ellipse', color: '#facc15' })
    expect(pictureOf(def({ color: undefined })).kind).toBe('flat')
  })

  describe('a character with an animation', () => {
    const animation = {
      image: 'art/coin.png',
      frame: { w: 8, h: 8 },
      clips: [
        { id: 'spin', frames: [2, 3], fps: 8, loop: true },
        { id: 'idle', frames: [0], fps: 4, loop: false },
      ],
    }

    it('is the first frame of its first clip, with the look it falls back to while the picture is missing', () => {
      expect(pictureOf(def({ color: '#facc15', animation }))).toEqual({
        kind: 'clip',
        image: 'art/coin.png',
        cell: { w: 8, h: 8 },
        index: 2,
        still: { kind: 'flat', shape: 'ellipse', color: '#facc15' },
      })
    })

    it('falls back to its tile when it is a tile character', () => {
      const tile = { tileset: 'terrain', index: 3 }
      expect(pictureOf(def({ shape: 'tile', tile, animation }))).toMatchObject({
        kind: 'clip',
        still: { kind: 'tile', tileset: 'terrain', index: 3 },
      })
    })

    it('is its still look when no clip has a frame', () => {
      const empty = { ...animation, clips: [{ id: 'spin', frames: [], fps: 8, loop: true }] }
      expect(pictureOf(def({ color: '#facc15', animation: empty })).kind).toBe('flat')
    })
  })
})
