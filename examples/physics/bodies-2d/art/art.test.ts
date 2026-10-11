import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BODY_SPRITES } from './sprites.ts'

// The same palette gate as base-2d's art.test.ts: every color the demo draws is an Endesga 64 color, checked
// against the palette file exactly as the Owner supplied it.
const fromFile = readFileSync(
  new URL('../../../../docs/art/palettes/endesga-64.txt', import.meta.url),
  'utf8',
)
  .split(/\r?\n/)
  .filter((line) => line !== '' && !line.startsWith(';'))
  .map((line) => `#${line.slice(2).toLowerCase()}`)

describe('the body sprites', () => {
  it.each(Object.entries(BODY_SPRITES))('%s is an 8 × 8 rectangle of known palette keys', (_name, sprite) => {
    expect([sprite.width, sprite.height]).toEqual([8, 8])
    expect(sprite.rows).toHaveLength(8)
    for (const row of sprite.rows) {
      expect(row).toHaveLength(8)
      for (const key of row) if (key !== '.') expect(sprite.palette).toHaveProperty(key)
    }
  })

  it.each(Object.entries(BODY_SPRITES))('%s uses only Endesga 64 colors', (_name, sprite) => {
    expect(fromFile).toHaveLength(64)
    for (const color of Object.values(sprite.palette)) expect(fromFile).toContain(color)
  })
})
