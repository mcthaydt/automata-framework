// A reader for the PNGs Playwright takes (8-bit RGB or RGBA, no interlace), so a journey can look at the pixels of what
// the game drew. It takes the screenshot as the browser gives it; it is not a general PNG decoder.
import { inflateSync } from 'node:zlib'

export interface Pixels {
  readonly width: number
  readonly height: number
  /** The colour at (x, y) as [r, g, b]. */
  at(x: number, y: number): readonly [number, number, number]
}

export function readPng(png: Buffer): Pixels {
  let width = 0
  let height = 0
  let channels = 3
  const data: Buffer[] = []
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at)
    const type = png.toString('latin1', at + 4, at + 8)
    const body = png.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      if (body[8] !== 8 || body[12] !== 0) throw new Error('readPng: only 8-bit, non-interlaced pictures')
      channels = body[9] === 6 ? 4 : 3
    } else if (type === 'IDAT') data.push(body)
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * channels
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0
    for (let i = 0; i < stride; i++) {
      const value = raw[y * (stride + 1) + 1 + i] ?? 0
      const left = i >= channels ? (out[y * stride + i - channels] ?? 0) : 0
      const up = y > 0 ? (out[(y - 1) * stride + i] ?? 0) : 0
      const upLeft = y > 0 && i >= channels ? (out[(y - 1) * stride + i - channels] ?? 0) : 0
      let predicted = 0
      if (filter === 1) predicted = left
      else if (filter === 2) predicted = up
      else if (filter === 3) predicted = (left + up) >> 1
      else if (filter === 4) {
        const p = left + up - upLeft
        const pl = Math.abs(p - left)
        const pu = Math.abs(p - up)
        const pul = Math.abs(p - upLeft)
        predicted = pl <= pu && pl <= pul ? left : pu <= pul ? up : upLeft
      }
      out[y * stride + i] = (value + predicted) & 255
    }
  }
  return {
    width,
    height,
    at: (x, y) => {
      const i = y * stride + x * channels
      return [out[i] ?? 0, out[i + 1] ?? 0, out[i + 2] ?? 0]
    },
  }
}
