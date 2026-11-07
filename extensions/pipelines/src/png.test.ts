import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodePng } from './png.ts'

// A PNG decoder in plain TypeScript (zlib from node), for the shots stage's legibility read. It handles the shots a headless browser writes:
// 8-bit grey, grey+alpha, RGB and RGBA, not interlaced, every scanline filter.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (bytes: Uint8Array): number => {
  let c = 0xffffffff
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)))
  return out
}
const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

/** Encodes `rows` of pixels (each a list of channel bytes), choosing each scanline's filter from `filters`. */
function encode(
  width: number,
  channels: 1 | 2 | 3 | 4,
  rows: number[][][],
  filters: number[],
  interlace = 0,
): Uint8Array {
  const colour = { 1: 0, 2: 4, 3: 2, 4: 6 }[channels]
  const header = new Uint8Array(13)
  const hv = new DataView(header.buffer)
  hv.setUint32(0, width)
  hv.setUint32(4, rows.length)
  header[8] = 8
  header[9] = colour
  header[12] = interlace
  const raw: number[] = []
  let previous: number[] = new Array(width * channels).fill(0)
  rows.forEach((row, y) => {
    const line = row.flat()
    const filter = filters[y % filters.length] as number
    raw.push(filter)
    line.forEach((value, i) => {
      const left = i >= channels ? (line[i - channels] as number) : 0
      const up = previous[i] as number
      const upLeft = i >= channels ? (previous[i - channels] as number) : 0
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? up
              : filter === 3
                ? Math.floor((left + up) / 2)
                : (() => {
                    const p = left + up - upLeft
                    const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)] as const
                    return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
                  })()
      raw.push((value - predictor + 256) % 256)
    })
    previous = line
  })
  const parts = [
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Uint8Array.from(raw))),
    chunk('IEND', new Uint8Array()),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

const gradient = (width: number, height: number, channels: 1 | 2 | 3 | 4): number[][][] =>
  Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      Array.from({ length: channels }, (_, c) => (x * 17 + y * 31 + c * 53) % 256),
    ),
  )

describe('decodePng', () => {
  for (const channels of [1, 2, 3, 4] as const) {
    it(`reads ${channels} channel(s) through every scanline filter`, () => {
      const rows = gradient(7, 5, channels)
      const image = decodePng(encode(7, channels, rows, [0, 1, 2, 3, 4]))
      expect(image.width).toBe(7)
      expect(image.height).toBe(5)
      expect(image.channels).toBe(channels)
      expect(Array.from(image.data)).toEqual(rows.flat(2))
    })
  }

  it('refuses a file that is not a PNG', () => {
    expect(() => decodePng(new Uint8Array(40))).toThrow(/not a PNG/)
  })

  it('refuses an interlaced PNG, saying so', () => {
    expect(() => decodePng(encode(2, 3, gradient(2, 2, 3), [0], 1))).toThrow(/interlaced/)
  })
})
