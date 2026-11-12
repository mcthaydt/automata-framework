// A small RGBA raster for the figure sheets: fill, blit at a whole-number scale (nearest neighbour, so a texel stays a square),
// label in a built-in 5 × 7 font, and read and write PNG with Node's zlib. It needs no canvas and no browser, so a sheet of the
// painter's cells is made wherever Node runs.
import { crc32, deflateSync, inflateSync } from 'node:zlib'

export type Rgba = readonly [number, number, number, number]

export interface Raster {
  readonly w: number
  readonly h: number
  /** RGBA, `w` by `h`. */
  readonly data: Uint8ClampedArray
}

export const newRaster = (w: number, h: number): Raster => ({ w, h, data: new Uint8ClampedArray(w * h * 4) })

/** Fills a rectangle (clipped to the raster) with one colour. */
export function fill(r: Raster, x: number, y: number, w: number, h: number, colour: Rgba): void {
  for (let j = Math.max(0, y); j < Math.min(r.h, y + h); j++)
    for (let i = Math.max(0, x); i < Math.min(r.w, x + w); i++) r.data.set(colour, (j * r.w + i) * 4)
}

/** Draws `src` over `dst` at (`x`, `y`), each texel `scale` square; a texel with alpha 0 leaves `dst` as it is. */
export function blit(dst: Raster, src: Raster, x: number, y: number, scale = 1): void {
  for (let j = 0; j < src.h; j++)
    for (let i = 0; i < src.w; i++) {
      const at = (j * src.w + i) * 4
      if ((src.data[at + 3] ?? 0) === 0) continue
      fill(dst, x + i * scale, y + j * scale, scale, scale, [
        src.data[at] ?? 0,
        src.data[at + 1] ?? 0,
        src.data[at + 2] ?? 0,
        255,
      ])
    }
}

/** A sub-rectangle of `r` as a raster of its own. */
export function crop(r: Raster, x: number, y: number, w: number, h: number): Raster {
  const out = newRaster(w, h)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const from = ((y + j) * r.w + x + i) * 4
      if (x + i < r.w && y + j < r.h) out.data.set(r.data.subarray(from, from + 4), (j * w + i) * 4)
    }
  return out
}

// The font: 5 columns by 7 rows, a glyph one string of its 7 rows between bars ('#' is ink). Lower case is drawn as upper.
const GLYPHS: Readonly<Record<string, string>> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.###.',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '#####|...#.|..#..|...#.|....#|#...#|.###.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
  '.': '.....|.....|.....|.....|.....|.##..|.##..',
  ',': '.....|.....|.....|.....|.##..|..#..|.#...',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....',
  '-': '.....|.....|.....|#####|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.',
  ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  '=': '.....|.....|#####|.....|#####|.....|.....',
  '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##',
  "'": '..#..|..#..|.#...|.....|.....|.....|.....',
  x: '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
}
const GLYPH_W = 5
const GLYPH_H = 7
const GAP = 1

/** The 7 rows of the glyph for `ch`; a character the font lacks is a box. */
function glyphOf(ch: string): readonly string[] {
  const g = GLYPHS[ch.toUpperCase()] ?? (ch === '×' ? GLYPHS.x : undefined)
  return g === undefined ? Array.from({ length: GLYPH_H }, () => '#####') : g.split('|')
}

/** The width in texels `str` takes at `scale`. */
export const textWidth = (str: string, scale: number): number =>
  Math.max(0, str.length * (GLYPH_W + GAP) - GAP) * scale

/** The height in texels a line of text takes at `scale`. */
export const textHeight = (scale: number): number => GLYPH_H * scale

/** Writes `str` with its top-left at (`x`, `y`), each font texel `scale` square. */
export function text(r: Raster, str: string, x: number, y: number, scale: number, ink: Rgba): void {
  let at = x
  for (const ch of str) {
    glyphOf(ch).forEach((row, j) => {
      for (let i = 0; i < row.length; i++)
        if (row[i] === '#') fill(r, at + i * scale, y + j * scale, scale, scale, ink)
    })
    at += (GLYPH_W + GAP) * scale
  }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(body.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0)
  return Buffer.concat([head, body, crc])
}

/** The raster as an 8-bit RGBA PNG. */
export function encodePng(r: Raster): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(r.w, 0)
  header.writeUInt32BE(r.h, 4)
  header.set([8, 6, 0, 0, 0], 8)
  const rows = Buffer.alloc(r.h * (1 + r.w * 4))
  for (let j = 0; j < r.h; j++) {
    rows[j * (1 + r.w * 4)] = 0
    rows.set(r.data.subarray(j * r.w * 4, (j + 1) * r.w * 4), j * (1 + r.w * 4) + 1)
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** An 8-bit, non-interlaced RGBA or RGB PNG as a raster (what the old game's sheets are). */
export function decodePng(png: Uint8Array): Raster {
  const bytes = Buffer.from(png)
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG')
  let w = 0
  let h = 0
  let colour = 0
  const idat: Buffer[] = []
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at)
    const type = bytes.toString('ascii', at + 4, at + 8)
    const body = bytes.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      w = body.readUInt32BE(0)
      h = body.readUInt32BE(4)
      colour = body[9] ?? 0
      if (body[8] !== 8 || (colour !== 6 && colour !== 2) || body[12] !== 0)
        throw new Error('only 8-bit non-interlaced RGB or RGBA PNG is read')
    } else if (type === 'IDAT') idat.push(body)
    at += 12 + length
  }
  const bpp = colour === 6 ? 4 : 3
  const stride = w * bpp
  const raw = inflateSync(Buffer.concat(idat))
  const prev = Buffer.alloc(stride)
  const line = Buffer.alloc(stride)
  const out = newRaster(w, h)
  for (let j = 0; j < h; j++) {
    const filter = raw[j * (stride + 1)] ?? 0
    for (let i = 0; i < stride; i++) {
      const x = raw[j * (stride + 1) + 1 + i] ?? 0
      const a = i >= bpp ? (line[i - bpp] ?? 0) : 0
      const b = prev[i] ?? 0
      const c = i >= bpp ? (prev[i - bpp] ?? 0) : 0
      const p = a + b - c
      const pa = Math.abs(p - a)
      const pb = Math.abs(p - b)
      const pc = Math.abs(p - c)
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      line[i] = (x + [0, a, b, (a + b) >> 1, paeth][filter]!) & 255
    }
    for (let i = 0; i < w; i++) {
      out.data.set(
        [
          line[i * bpp] ?? 0,
          line[i * bpp + 1] ?? 0,
          line[i * bpp + 2] ?? 0,
          bpp === 4 ? (line[i * bpp + 3] ?? 0) : 255,
        ],
        (j * w + i) * 4,
      )
    }
    line.copy(prev)
  }
  return out
}
