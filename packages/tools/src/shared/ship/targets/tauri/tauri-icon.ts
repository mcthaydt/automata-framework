import { deflateSync } from 'node:zlib'

// The app icon ship draws when a game names none (`tauri.icon`): a dark square with an ember-coloured
// one inside, as an 8-bit RGBA PNG. Tauri needs an icon to build at all; a game ships its own.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** One PNG chunk: length, type, data, and the CRC of type and data. */
function chunk(type: string, data: Buffer): Buffer {
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  typed.copy(out, 4)
  out.writeUInt32BE(crc32(typed), 8 + data.length)
  return out
}

const BACKGROUND = [0x2e, 0x22, 0x2f, 0xff] as const
const EMBER = [0xf4, 0x8c, 0x2a, 0xff] as const

/** A `size` × `size` icon as PNG bytes; the same size always gives the same bytes. */
export function tauriIconPng(size: number): Buffer {
  const row = 1 + size * 4
  const pixels = Buffer.alloc(row * size)
  const inset = Math.round(size / 4)
  for (let y = 0; y < size; y++) {
    pixels[y * row] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const inside = x >= inset && x < size - inset && y >= inset && y < size - inset
      const colour = inside ? EMBER : BACKGROUND
      pixels.set(colour, y * row + 1 + x * 4)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
