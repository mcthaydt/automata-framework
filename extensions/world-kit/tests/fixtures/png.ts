// Small PNGs made by the tests, so no test reads a photo from disk to prove the pipeline: an 8-bit RGB image from a pixel
// function, deflated with filter 0.
import { deflateSync } from 'node:zlib'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (bytes: Uint8Array): number => {
  let c = 0xffffffff
  for (const b of bytes) c = (crcTable[(c ^ b) & 255] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (kind: string, body: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + body.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, body.length)
  out.set(Buffer.from(kind, 'ascii'), 4)
  out.set(body, 8)
  view.setUint32(8 + body.length, crc(out.subarray(4, 8 + body.length)))
  return out
}

/** A PNG of `width` × `height` pixels, `pixel(x, y)` giving `0xRRGGBB`. */
export function makePng(width: number, height: number, pixel: (x: number, y: number) => number): Uint8Array {
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header.set([8, 2, 0, 0, 0], 8)
  const raw = new Uint8Array(height * (1 + width * 3))
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const c = pixel(x, y)
      raw.set([(c >> 16) & 255, (c >> 8) & 255, c & 255], y * (1 + width * 3) + 1 + x * 3)
    }
  const parts = [
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]
  return Buffer.concat(parts)
}

/** A checker of two colours, squares of `cell` pixels. */
export const checkerPng = (size: number, cell = 4, a = 0xc9b79c, b = 0x6b5a48): Uint8Array =>
  makePng(size, size, (x, y) => ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? a : b))
