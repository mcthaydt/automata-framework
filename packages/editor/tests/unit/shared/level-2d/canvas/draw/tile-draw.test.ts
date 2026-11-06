import { describe, expect, it } from 'vitest'
import { PLACEHOLDER_COLORS, tileDraw } from '#src/shared/level-2d/canvas/draw/tile-draw.ts'
import type { TilesetDef } from '#src/shared/level-2d/model/project-types.ts'

// A 4 × 3 set of 16 px tiles with 2 px between them and 1 px around: 1 + 4 × 16 + 3 × 2 + 1 = 72 wide, 1 + 3 × 16 +
// 2 × 2 + 1 = 54 high.
const art: TilesetDef = {
  id: 'art',
  label: 'Art',
  image: 'assets/art.png',
  imageSize: { w: 72, h: 54 },
  tile: { w: 16, h: 16 },
  spacing: 2,
  padding: 1,
  tags: [],
}
const loaded = new Set(['assets/art.png'])
const at = { x: 32, y: 48, w: 16, h: 16 }
const plain = (tile: number) => ({ tile, flipX: false, flipY: false })

describe('tileDraw', () => {
  it('draws a tile of a loaded image from its frame, row-major, past the padding and the spacing', () => {
    expect(tileDraw(art, loaded, plain(0), at)).toEqual({
      ...at,
      tile: 0,
      flipX: false,
      flipY: false,
      kind: 'image',
      image: 'assets/art.png',
      frame: { x: 1, y: 1, w: 16, h: 16 },
    })
    expect(tileDraw(art, loaded, plain(6), at)).toMatchObject({ frame: { x: 37, y: 19, w: 16, h: 16 } })
    expect(tileDraw(art, loaded, plain(11), at)).toMatchObject({ frame: { x: 55, y: 37, w: 16, h: 16 } })
  })

  it('passes the flips through', () => {
    expect(tileDraw(art, loaded, { tile: 1, flipX: true, flipY: false }, at)).toMatchObject({
      flipX: true,
      flipY: false,
    })
    expect(tileDraw(art, new Set(), { tile: 1, flipX: false, flipY: true }, at)).toMatchObject({
      flipX: false,
      flipY: true,
      kind: 'placeholder',
    })
  })

  it('numbers a placeholder by its index and says why it is one', () => {
    const { image: _image, ...noImage } = art
    expect(tileDraw(noImage, loaded, plain(5), at)).toEqual({
      ...at,
      tile: 5,
      flipX: false,
      flipY: false,
      kind: 'placeholder',
      reason: 'placeholder',
      color: PLACEHOLDER_COLORS[5],
      label: '5',
    })
    expect(tileDraw(art, new Set(['assets/other.png']), plain(5), at)).toMatchObject({
      kind: 'placeholder',
      reason: 'missing',
      label: '5',
    })
    expect(tileDraw(art, loaded, plain(12), at)).toMatchObject({ reason: 'outOfRange', label: '12' })
    expect(tileDraw(undefined, loaded, plain(3), at)).toMatchObject({ reason: 'noTileset', label: '3' })
  })

  it('colours a placeholder by its index alone, from a fixed palette', () => {
    expect(PLACEHOLDER_COLORS).toHaveLength(12)
    for (const color of PLACEHOLDER_COLORS) expect(color).toMatch(/^#[0-9a-f]{6}$/)
    expect(new Set(PLACEHOLDER_COLORS).size).toBe(12)
    const colorOf = (tile: number, reason: Set<string>) => {
      const drawn = tileDraw(art, reason, plain(tile), at)
      return drawn.kind === 'placeholder' ? drawn.color : undefined
    }
    expect(colorOf(13, loaded)).toBe(PLACEHOLDER_COLORS[1])
    expect(colorOf(7, new Set())).toBe(PLACEHOLDER_COLORS[7])
    expect(colorOf(19, new Set())).toBe(PLACEHOLDER_COLORS[7])
  })
})
