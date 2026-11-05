import { describe, expect, it } from 'vitest'
import { fontFilesSchema, fontsSchema } from '#src/features/assets/fonts.schema.ts'
import { parseDocument } from '#src/features/parse/parse-document.ts'
import { formatDiagnostic } from '#src/shared/diagnostics/diagnostic.ts'

// `content/fonts.toml` (M5 spec §4.7 Fonts, M5-D7): each committed source font, its recorded hash and licence, and
// the content languages it serves.

const HASH = 'd830612ac9131788ebae754b9268f83f7c1d3ffa9bc0f9a5514207a8283fe71e'
const parse = (text: string) => parseDocument({ file: 'content/fonts.toml', text }, fontsSchema)
const font = (fields: string) => `[font.pixel]\n${fields}\n`
const valid = `file = "fonts/pixel.woff2"\nsha256 = "${HASH}"\nlicense = "OFL-1.1"\nlocales = ["en", "fr"]`

function refusals(text: string): string[] {
  const parsed = parse(text)
  if (parsed.ok) throw new Error('expected a refusal')
  return parsed.diagnostics.map(formatDiagnostic)
}

describe('fontsSchema', () => {
  it('reads each font by name', () => {
    const parsed = parse(font(valid))
    expect(parsed.ok && parsed.value).toEqual({
      font: { pixel: { file: 'fonts/pixel.woff2', sha256: HASH, license: 'OFL-1.1', locales: ['en', 'fr'] } },
    })
  })

  it('refuses a font name that is not like pixel or ui-cjk', () => {
    expect(refusals(`[font.Pixel_Font]\n${valid}\n`)).toEqual([
      'content/fonts.toml:1:1  font.Pixel_Font  invalidType: Invalid key in record',
    ])
  })

  it('refuses an empty locales list', () => {
    expect(refusals(font(valid.replace('["en", "fr"]', '[]'))).join('\n')).toContain('font.pixel.locales')
  })

  it('refuses a sha256 that is not 64 lower-case hex characters', () => {
    expect(refusals(font(valid.replace(HASH, HASH.toUpperCase()))).join('\n')).toContain('font.pixel.sha256')
  })

  it('refuses an unknown key', () => {
    expect(refusals(font(`${valid}\nweight = 400`)).join('\n')).toContain('weight')
  })
})

// `fonts.json`, which the font build writes beside the subsets: each font's subset file for each language. The
// preload list reads it back (M5.6F.2); `preload-list.test.ts` reads a real build's file with this schema.
describe('fontFilesSchema', () => {
  it("reads each font's subset file by language", () => {
    const files = { pixel: { en: 'pixel-en-0123abcd.woff2', fr: 'pixel-fr-4567cdef.woff2' } }
    expect(fontFilesSchema.parse(files)).toEqual(files)
  })

  it('refuses a subset that is not a file name', () => {
    expect(fontFilesSchema.safeParse({ pixel: { en: 1 } }).success).toBe(false)
    expect(fontFilesSchema.safeParse({ pixel: 'pixel-en-0123abcd.woff2' }).success).toBe(false)
  })
})
