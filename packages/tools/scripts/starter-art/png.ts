import { deflateSync } from 'node:zlib'

// A PNG from RGBA pixels, with Node's own zlib: the starter sheets are made by a script, so no image tool is needed and
// the same pixels always give the same bytes.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

/** A picture: `rgba` holds four bytes a pixel, row by row. */
export interface Picture {
  readonly width: number
  readonly height: number
  readonly rgba: Uint8Array
}

/** The PNG file of a picture. */
export function encodePng(picture: Picture): Buffer {
  const { width, height, rgba } = picture
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    rows[y * (width * 4 + 1)] = 0 // no filter
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(rows, y * (width * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** A blank, transparent picture. */
export const blank = (width: number, height: number): Picture => ({
  width,
  height,
  rgba: new Uint8Array(width * height * 4),
})

/** Sets one pixel to `#rrggbb`; a point outside the picture is ignored. */
export function plot(picture: Picture, x: number, y: number, colour: string): void {
  if (x < 0 || y < 0 || x >= picture.width || y >= picture.height) return
  const at = (y * picture.width + x) * 4
  picture.rgba[at] = Number.parseInt(colour.slice(1, 3), 16)
  picture.rgba[at + 1] = Number.parseInt(colour.slice(3, 5), 16)
  picture.rgba[at + 2] = Number.parseInt(colour.slice(5, 7), 16)
  picture.rgba[at + 3] = 255
}

/** Draws `rows` (one string a row, one character a pixel, `.` transparent) at (`x`, `y`), by `palette`. */
export function stamp(
  picture: Picture,
  x: number,
  y: number,
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
): void {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx += 1) {
      const key = row[dx] as string
      if (key === '.') continue
      const colour = palette[key]
      if (colour === undefined) throw new Error(`The palette has no "${key}".`)
      plot(picture, x + dx, y + dy, colour)
    }
  })
}
