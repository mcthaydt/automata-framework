// A PNG reader, enough for the photo library (8-bit greyscale, RGB or RGBA, not interlaced). Deterministic on every
// machine (no image library, no colour management), so a photo decodes to the same bytes wherever a tile is made.
// Node only: it inflates with `node:zlib`.

import { inflateSync } from 'node:zlib'

export interface Image {
  readonly width: number
  readonly height: number
  /** Four bytes a pixel. */
  readonly rgba: Uint8ClampedArray
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 4: 2, 6: 4 }

/** Reads a PNG's bytes; throws a sentence that names what is wrong when they are not one this reader takes. */
export function decodePng(bytes: Uint8Array): Image {
  if (!SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error('This file is not a PNG image.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 8
  let width = 0
  let height = 0
  let depth = 0
  let type = 0
  let interlace = 0
  const data: Uint8Array[] = []
  while (at < bytes.length) {
    const length = view.getUint32(at)
    const kind = String.fromCharCode(...bytes.subarray(at + 4, at + 8))
    const body = bytes.subarray(at + 8, at + 8 + length)
    if (kind === 'IHDR') {
      width = view.getUint32(at + 8)
      height = view.getUint32(at + 12)
      depth = body[8] ?? 0
      type = body[9] ?? 0
      interlace = body[12] ?? 0
    } else if (kind === 'IDAT') data.push(body)
    else if (kind === 'IEND') break
    at += 12 + length
  }
  const channels = CHANNELS[type]
  if (depth !== 8 || channels === undefined || interlace !== 0)
    throw new Error(
      `This PNG is not one the texture tool reads (bit depth ${depth}, colour type ${type}, interlace ${interlace}). Save it as an 8-bit, non-interlaced image.`,
    )
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * channels
  const px = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0
    const src = y * (stride + 1) + 1
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? (px[row + x - channels] ?? 0) : 0
      const b = y > 0 ? (px[row - stride + x] ?? 0) : 0
      const c = x >= channels && y > 0 ? (px[row - stride + x - channels] ?? 0) : 0
      let v = raw[src + x] ?? 0
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[row + x] = v & 255
    }
  }
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const s = i * channels
    const grey = channels <= 2
    rgba[i * 4] = px[s] ?? 0
    rgba[i * 4 + 1] = grey ? (px[s] ?? 0) : (px[s + 1] ?? 0)
    rgba[i * 4 + 2] = grey ? (px[s] ?? 0) : (px[s + 2] ?? 0)
    rgba[i * 4 + 3] = channels === 2 ? (px[s + 1] ?? 255) : channels === 4 ? (px[s + 3] ?? 255) : 255
  }
  return { width, height, rgba }
}
