// Raw pixels to a PNG, for the kit's study scripts: a nearest-neighbour blit of a painted cell onto a sheet, the box a figure covers,
// and a PNG writer (node:zlib), so a script needs no canvas package.
import { deflateSync } from 'node:zlib'

const crc = (b: Buffer) => {
  let c = ~0
  for (const x of b) {
    c ^= x
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
const chunk = (type: string, data: Buffer) => {
  const t = Buffer.concat([Buffer.from(type), data]),
    len = Buffer.alloc(4),
    sum = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  sum.writeUInt32BE(crc(t))
  return Buffer.concat([len, t, sum])
}
export const png = (rgba: Uint8Array, w: number, h: number) => {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(w, 0)
  head.writeUInt32BE(h, 4)
  head[8] = 8
  head[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
/** Nearest-neighbour blit of a source rectangle, scaled by z, over the sheet (transparent texels leave the ground). */
export function blit(
  dst: Uint8Array,
  dw: number,
  src: Uint8ClampedArray,
  sw: number,
  r: number[],
  dx: number,
  dy: number,
  z: number,
) {
  const [sx = 0, sy = 0, cw = 0, ch = 0] = r
  for (let y = 0; y < ch * z; y++)
    for (let x = 0; x < cw * z; x++) {
      const X = sx + Math.floor(x / z),
        Y = sy + Math.floor(y / z)
      if (X < 0 || Y < 0 || X >= sw || (Y + 1) * sw * 4 > src.length) continue
      const s = (Y * sw + X) * 4,
        d = ((dy + y) * dw + dx + x) * 4
      if (src[s + 3] === 0) continue
      dst[d] = src[s] ?? 0
      dst[d + 1] = src[s + 1] ?? 0
      dst[d + 2] = src[s + 2] ?? 0
      dst[d + 3] = 255
    }
}
export function bbox(px: Uint8ClampedArray, w: number, h: number) {
  let x0 = w,
    x1 = -1,
    y0 = h,
    y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3]) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
  return { x0, x1, y0, y1 }
}
