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

/** The smallest box holding every pixel that is exactly `color`, or undefined when there is none. */
export function boxOf(
  pixels: Pixels,
  color: readonly [number, number, number],
): { x: number; y: number; w: number; h: number } | undefined {
  let minX = pixels.width
  let minY = pixels.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < pixels.height; y++)
    for (let x = 0; x < pixels.width; x++) {
      const [r, g, b] = pixels.at(x, y)
      if (r !== color[0] || g !== color[1] || b !== color[2]) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  return maxX < 0 ? undefined : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}
