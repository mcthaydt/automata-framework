import { describe, expect, it } from 'vitest'
import {
  composePage,
  decodePng,
  encodePng,
  type Rgba,
  spritesheetJson,
} from '#src/features/assets/atlas-image.ts'
import { packFrames } from '#src/features/assets/atlas-pack.ts'

// Atlas pages as pixels and files (M5 spec §4.7): frames drawn at their placements with their edge pixels
// repeated into the extrusion, PNG bytes that are the same for the same pixels (G-c), and Pixi's Spritesheet JSON.

/** A `width` × `height` image whose pixel (x, y) is `paint(x, y)` as [r, g, b, a]. */
function image(width: number, height: number, paint: (x: number, y: number) => readonly number[]): Rgba {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4)
  return { width, height, data }
}

const pixel = (rgba: Rgba, x: number, y: number) => [
  ...rgba.data.subarray((y * rgba.width + x) * 4, (y * rgba.width + x) * 4 + 4),
]

// A 2 × 2 frame with four distinct colours, so each corner's extrusion is checkable.
const QUAD = image(2, 2, (x, y) => [x * 100 + 10, y * 100 + 10, 50, 255])

describe('composePage', () => {
  const { pageSizes, placements } = packFrames([{ name: 'quad', width: 2, height: 2 }])
  const page = composePage(pageSizes[0]!, placements, new Map([['quad', QUAD]]))

  it("draws the frame's pixels at its placement", () => {
    expect(placements[0]).toMatchObject({ x: 2, y: 2 })
    expect(pixel(page, 2, 2)).toEqual(pixel(QUAD, 0, 0))
    expect(pixel(page, 3, 3)).toEqual(pixel(QUAD, 1, 1))
  })

  it('repeats each edge pixel into the extrusion, corners included', () => {
    expect(pixel(page, 1, 2)).toEqual(pixel(QUAD, 0, 0)) // left
    expect(pixel(page, 4, 3)).toEqual(pixel(QUAD, 1, 1)) // right
    expect(pixel(page, 3, 1)).toEqual(pixel(QUAD, 1, 0)) // top
    expect(pixel(page, 2, 4)).toEqual(pixel(QUAD, 0, 1)) // bottom
    expect(pixel(page, 1, 1)).toEqual(pixel(QUAD, 0, 0)) // corners
    expect(pixel(page, 4, 4)).toEqual(pixel(QUAD, 1, 1))
  })

  it('leaves the padding transparent', () => {
    expect(pixel(page, 0, 0)).toEqual([0, 0, 0, 0])
    expect(pixel(page, 5, 2)).toEqual([0, 0, 0, 0])
  })
})

describe('PNG', () => {
  const page = image(8, 8, (x, y) => [x * 30, y * 30, (x + y) % 2 === 0 ? 255 : 0, x < 4 ? 255 : 0])

  it('writes the same bytes for the same pixels (G-c), and reads them back pixel for pixel', () => {
    const first = encodePng(page)
    expect(encodePng(page)).toEqual(first)
    expect([...first.subarray(1, 4)].map((code) => String.fromCharCode(code)).join('')).toBe('PNG')
    expect(decodePng(first)).toEqual(page)
  })

  it('refuses bytes that are not a PNG', () => {
    expect(() => decodePng(new TextEncoder().encode('not a png'))).toThrow()
  })
})

describe('spritesheetJson', () => {
  it("gives Pixi's Spritesheet data, with the frames in placement order and fixed text", () => {
    const { pageSizes, placements } = packFrames([
      { name: 'run-b', width: 16, height: 16 },
      { name: 'run-a', width: 16, height: 16 },
    ])
    const text = spritesheetJson(0, pageSizes[0]!, 'wick-0.png', placements)
    expect(JSON.parse(text)).toEqual({
      frames: {
        'run-a': {
          frame: { x: 2, y: 2, w: 16, h: 16 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 16, h: 16 },
          sourceSize: { w: 16, h: 16 },
        },
        'run-b': {
          frame: { x: 21, y: 2, w: 16, h: 16 },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: 16, h: 16 },
          sourceSize: { w: 16, h: 16 },
        },
      },
      meta: {
        app: 'automata-content',
        image: 'wick-0.png',
        format: 'RGBA8888',
        size: { w: 64, h: 64 },
        scale: 1,
      },
    })
    expect(Object.keys(JSON.parse(text).frames)).toEqual(['run-a', 'run-b'])
    expect(text.endsWith('\n')).toBe(true)
  })

  it('lists only the frames on its page', () => {
    const placements = [
      { name: 'a', page: 0, x: 2, y: 2, width: 4, height: 4 },
      { name: 'b', page: 1, x: 2, y: 2, width: 4, height: 4 },
    ]
    expect(Object.keys(JSON.parse(spritesheetJson(1, 2048, 'x-1.png', placements)).frames)).toEqual(['b'])
  })
})
