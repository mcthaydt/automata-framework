// @vitest-environment node
import { crc32, deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { measureWord } from '../../e2e/harness/word-pixels.ts'

const chunk = (type: string, data: Buffer): Buffer => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const edge = Buffer.alloc(4)
  edge.writeUInt32BE(data.length)
  const check = Buffer.alloc(4)
  check.writeUInt32BE(crc32(body))
  return Buffer.concat([edge, body, check])
}

/** A black picture with white boxes `[x, y, width, height]`, as an 8-bit RGB PNG. */
function picture(
  width: number,
  height: number,
  boxes: readonly (readonly [number, number, number, number])[],
): Buffer {
  const rows = Buffer.alloc((width * 3 + 1) * height)
  for (const [bx, by, bw, bh] of boxes)
    for (let y = by; y < by + bh; y++)
      for (let x = bx; x < bx + bw; x++)
        rows.fill(255, y * (width * 3 + 1) + 1 + x * 3, y * (width * 3 + 1) + 4 + x * 3)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

describe('measureWord', () => {
  it('reads the height of the first letter, so a comma or a mark below the line does not make a word taller', () => {
    // A capital 20 px tall (10 CSS px at 2 px per CSS px), a gap, then a comma that hangs 4 px below the line.
    const png = picture(60, 40, [
      [10, 5, 8, 20],
      [24, 22, 3, 7],
    ])
    expect(measureWord(png, 2).capitalHeightCss).toBe(10)
  })

  it('reads a blank picture as no word', () => {
    expect(measureWord(picture(20, 20, []), 1)).toEqual({
      capitalHeightCss: 0,
      edgeRunDevice: Number.POSITIVE_INFINITY,
    })
  })
})
