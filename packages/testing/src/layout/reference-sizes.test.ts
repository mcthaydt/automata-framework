import { describe, expect, test } from 'vitest'
import { REFERENCE_SIZES, TIGHT_SIZES, VARIANTS } from './reference-sizes'

const has = (width: number, height: number): boolean =>
  REFERENCE_SIZES.some((size) => size.width === width && size.height === height)

describe('REFERENCE_SIZES (M1.6 spec §3.10)', () => {
  test("holds FloorFifty's sweep, including the phone held sideways at 780x270", () => {
    const sweep = [
      [360, 640],
      [375, 667],
      [390, 844],
      [430, 932],
      [667, 375],
      [844, 390],
      [932, 430],
      [780, 270],
      [844, 340],
      [667, 320],
      [1280, 480],
      [900, 600],
      [1280, 720],
      [1440, 900],
      [1180, 820],
      [744, 1133],
      [820, 1180],
      [1024, 1366],
    ] as const
    for (const [width, height] of sweep) expect(has(width, height), `${width}x${height}`).toBe(true)
  })

  test('holds both sides of every breakpoint', () => {
    const boundaries = [
      [599, 900],
      [600, 900],
      [900, 499],
      [900, 500],
      [900, 339],
      [900, 340],
      [900, 600],
      [900, 601],
    ] as const
    for (const [width, height] of boundaries) expect(has(width, height), `${width}x${height}`).toBe(true)
  })

  test('holds the tight sideways phones where a keyboard leaves the least room (framework audit, 2026-10-11)', () => {
    const tight = [
      [667, 260],
      [740, 300],
      [600, 240],
      [520, 180],
    ] as const
    expect(TIGHT_SIZES.map((size) => [size.width, size.height])).toEqual(
      expect.arrayContaining(tight.map((pair) => [...pair])),
    )
    expect(TIGHT_SIZES.every((size) => size.group === 'tight' && size.heightTier === 'compact')).toBe(true)
    expect(REFERENCE_SIZES.some((size) => size.group === 'tight')).toBe(false)
  })

  test('names each size once', () => {
    const names = REFERENCE_SIZES.map((size) => size.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('VARIANTS (M1.6 spec §3.10)', () => {
  test('rest, keyboard, a host strip on either edge and TV scale', () => {
    expect(VARIANTS.map((variant) => variant.name)).toEqual([
      'rest',
      'keyboard',
      'host-reserved-right',
      'host-reserved-left',
      'tv-scale',
    ])
  })

  test('the keyboard covers part of the height and never all of it', () => {
    const keyboard = VARIANTS.find((variant) => variant.name === 'keyboard')
    for (const size of REFERENCE_SIZES) {
      const covered = keyboard?.keyboard?.(size) ?? 0
      expect(covered).toBeGreaterThan(0)
      expect(covered).toBeLessThan(size.height)
    }
  })
})
