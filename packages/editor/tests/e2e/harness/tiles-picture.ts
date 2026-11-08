// A picture of tiles for the Add tiles journey: a real PNG, made here so no binary file sits in the repository.
import { crc32, deflateSync } from 'node:zlib'

const chunk = (type: string, data: Buffer): Buffer => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

/** A `width` x `height` PNG, every pixel opaque `color` (r, g, b): enough for the browser to decode and measure it. */
export function solidPng(width: number, height: number, color: readonly [number, number, number]): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8 bits, RGB, the usual compression, filter and no interlace
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: width }, () => color).flat()),
  ])
  const pixels = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * A picture of `columns` x `rows` square tiles of `tile` px, each tile one opaque colour of its own (`colors[index]`,
 * row by row), so a journey can tell which tile the game drew by the colour it finds.
 */
export function tilesPng(
  tile: number,
  columns: number,
  rows: number,
  colors: readonly (readonly [number, number, number])[],
): Buffer {
  const width = tile * columns
  const height = tile * rows
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const lines: Buffer[] = []
  for (let y = 0; y < height; y++) {
    const pixels: number[] = [0]
    for (let x = 0; x < width; x++) {
      const index = Math.floor(y / tile) * columns + Math.floor(x / tile)
      pixels.push(...(colors[index] ?? [0, 0, 0]))
    }
    lines.push(Buffer.from(pixels))
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(lines))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
