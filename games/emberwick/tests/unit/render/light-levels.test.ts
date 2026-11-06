import { describe, expect, it } from 'vitest'
import { lightLevel } from '#src/render/light-levels.ts'

describe('a pixel light', () => {
  it('is full at the centre and dark outside its radius', () => {
    expect(lightLevel(8, 8, 8)).toBe(1)
    expect(lightLevel(0, 0, 8)).toBe(0)
    expect(lightLevel(15, 8, 8)).toBeLessThan(0.5)
  })

  it('comes in a few hard steps, dithered between them, as pixel-art lighting does', () => {
    const levels = new Set<number>()
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) levels.add(lightLevel(x, y, 16))
    expect([...levels].sort()).toEqual([0, 0.25, 0.5, 0.75, 1])
  })

  it('never gets brighter further out along a row, apart from the dither', () => {
    const row = Array.from({ length: 16 }, (_, x) => lightLevel(16 + x, 16, 16))
    for (let x = 4; x < row.length; x++) expect(row[x]).toBeLessThanOrEqual((row[x - 4] as number) + 0.25)
  })
})
