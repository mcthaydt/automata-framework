import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fontCoverage, subsetWoff2 } from '#src/shared/assets/font-subset.ts'

// Subsetting (M5 spec §4.7 Fonts): a subset is cut to the characters asked for, with fixed options, so the same
// source and characters give the same bytes (G-a). Coverage reads the subset back, as the glyph gate does.

const source = new Uint8Array(
  readFileSync(
    new URL(
      '../../../../src/shared/assets/fixtures/fonts/pixelify-sans-latin-400-normal.woff2',
      import.meta.url,
    ),
  ),
)

describe('subsetWoff2', () => {
  it('gives identical bytes for the same source and characters (G-a)', async () => {
    const first = await subsetWoff2(source, new Set('Hello'))
    const second = await subsetWoff2(source, new Set('Hello'))
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
  })

  it('gives the same bytes whatever order the characters are in', async () => {
    const forward = await subsetWoff2(source, new Set('abc…'))
    const backward = await subsetWoff2(source, new Set('…cba'))
    expect(Buffer.from(forward).equals(Buffer.from(backward))).toBe(true)
  })

  it('writes woff2', async () => {
    const subset = await subsetWoff2(source, new Set('a'))
    expect(new TextDecoder().decode(subset.slice(0, 4))).toBe('wOF2')
  })
})

describe('fontCoverage', () => {
  it('covers the characters asked for that the font has, and not one it lacks', async () => {
    const has = fontCoverage(await subsetWoff2(source, new Set('Hö…日')))
    expect(['H', 'ö', '…'].every(has)).toBe(true)
    expect(has('日')).toBe(false)
  })

  it('leaves out a character that was not asked for', async () => {
    const has = fontCoverage(await subsetWoff2(source, new Set('H')))
    expect(has('H')).toBe(true)
    expect(has('Q')).toBe(false)
  })
  it('covers nothing in a subset that holds no character (an empty cmap fontkit cannot read)', async () => {
    const has = fontCoverage(await subsetWoff2(source, new Set('日')))
    expect(has('日')).toBe(false)
    expect(has('A')).toBe(false)
  })
})
