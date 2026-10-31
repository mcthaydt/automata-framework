// A PNG decoder in plain TypeScript (zlib from node) for the blockout shots stage's legibility read (M6.11). It reads what a headless browser
// writes: 8-bit grey, grey+alpha, RGB and RGBA, not interlaced, every scanline filter. Anything else is refused by name rather than misread.
import { inflateSync } from 'node:zlib'

export interface PngImage {
  readonly width: number
  readonly height: number
  /** 1 grey, 2 grey+alpha, 3 RGB, 4 RGBA. */
  readonly channels: 1 | 2 | 3 | 4
  /** `height` rows of `width * channels` bytes, unfiltered. */
  readonly data: Uint8Array
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const CHANNELS: Readonly<Record<number, 1 | 2 | 3 | 4>> = { 0: 1, 4: 2, 2: 3, 6: 4 }

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

export function decodePng(bytes: Uint8Array): PngImage {
  if (bytes.length < 8 || SIGNATURE.some((value, i) => bytes[i] !== value)) throw new Error('not a PNG file')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  let channels: 1 | 2 | 3 | 4 = 3
  const idat: Uint8Array[] = []
  for (let at = 8; at + 8 <= bytes.length; ) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8))
    const body = bytes.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = view.getUint32(at + 8)
      height = view.getUint32(at + 12)
      const depth = body[8]
      const colour = body[9] as number
      const found = CHANNELS[colour]
      if (depth !== 8 || found === undefined)
        throw new Error(
          `unsupported PNG (bit depth ${depth}, colour type ${colour}): the stage reads 8-bit grey, RGB and RGBA`,
        )
      if (body[12] !== 0) throw new Error('unsupported PNG: interlaced')
      channels = found
    } else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    at += 12 + length
  }
  const total = idat.reduce((n, part) => n + part.length, 0)
  const joined = new Uint8Array(total)
  let offset = 0
  for (const part of idat) {
    joined.set(part, offset)
    offset += part.length
  }
  const raw = inflateSync(joined)
  const stride = width * channels
  const data = new Uint8Array(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] as number
    for (let i = 0; i < stride; i += 1) {
      const x = raw[y * (stride + 1) + 1 + i] as number
      const left = i >= channels ? (data[y * stride + i - channels] as number) : 0
      const up = y > 0 ? (data[(y - 1) * stride + i] as number) : 0
      const upLeft = y > 0 && i >= channels ? (data[(y - 1) * stride + i - channels] as number) : 0
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? up
              : filter === 3
                ? (left + up) >> 1
                : filter === 4
                  ? paeth(left, up, upLeft)
                  : -1
      if (predictor < 0) throw new Error(`unsupported PNG scanline filter ${filter}`)
      data[y * stride + i] = (x + predictor) & 0xff
    }
  }
  return { width, height, channels, data }
}
