import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fontCoverage, subsetWoff2 } from '#src/shared/assets/font-subset.ts'
import { openFont } from '#src/testing/open-font.ts'

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

describe('subsetWoff2 with a reserved name', () => {
  // The OFL lets a subset (a Modified Version) keep the copyright and licence notices, and nothing that carries the
  // Reserved Font Name. The fixture's name is not reserved; the test reserves "Pixelify" to check the rename.
  const rename = { family: 'pixel ja', reservedName: 'Pixelify' }
  const names = async () => {
    const font = openFont(await subsetWoff2(source, new Set('Play'), rename))
    return { font, records: font.name.records }
  }

  it('comes out under the new family name, still woff2 and still drawing its letters', async () => {
    const cut = await subsetWoff2(source, new Set('Play'), rename)
    expect(new TextDecoder().decode(cut.slice(0, 4))).toBe('wOF2')
    const { font } = await names()
    expect(font.familyName).toBe('pixel ja')
    expect(font.postscriptName).toBe('pixel-ja')
    expect(fontCoverage(cut)('P')).toBe(true)
  })

  it('keeps the copyright notice and the licence address, and no other record names the reserved name', async () => {
    const { records } = await names()
    expect(records.copyright?.en).toContain('Pixelify Sans Project Authors')
    expect(records.licenseURL?.en).toBe('https://scripts.sil.org/OFL')
    for (const [id, text] of Object.entries(records))
      if (id !== 'copyright') expect(JSON.stringify(text)).not.toMatch(/pixelify/i)
  })

  it('gives the same bytes every time', async () => {
    const first = await subsetWoff2(source, new Set('Play'), rename)
    const second = await subsetWoff2(source, new Set('Play'), rename)
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
  })

  it('leaves a font whose name is not reserved exactly as the plain cut has it', async () => {
    const plain = await subsetWoff2(source, new Set('Play'))
    expect(openFont(plain).familyName).toBe('Pixelify Sans')
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
