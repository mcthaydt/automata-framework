// `content/fonts.toml`: each source font by name, committed by the game, with the
// sha256 of its bytes, its licence and the content languages it serves. There is no url:
// AF never fetches a font.
//
//   [font.pixel]
//   file = "fonts/pixelify-sans-latin-400.woff2"   # relative to the project root
//   sha256 = "d830…"
//   license = "OFL-1.1"
//   locales = ["en", "fr"]
import { z } from 'zod'

/** One source font: its committed file, the sha256 of its bytes, its licence and the languages it serves. */
export interface FontSource {
  readonly file: string
  readonly sha256: string
  readonly license: string
  readonly locales: readonly string[]
}

/** `content/fonts.toml`: each source font by name. */
export interface FontsFile {
  readonly font: Readonly<Record<string, FontSource>>
}

export const fontsSchema: z.ZodType<FontsFile> = z.strictObject({
  font: z.record(
    z.string().regex(/^[a-z0-9-]+$/, 'fonts are named like pixel or ui-cjk'),
    z.strictObject({
      file: z.string().min(1),
      sha256: z.string().regex(/^[0-9a-f]{64}$/, 'the sha256 of the file, 64 lower-case hex characters'),
      license: z.string().min(1),
      locales: z.array(z.string().min(1)).min(1, 'a font serves at least one language'),
    }),
  ),
})

/**
 * `fonts.json`, which `buildFonts` writes beside the subsets: for each font, its subset file for each language
 * (`{ "pixel": { "en": "pixel-en-0123abcd.woff2" } }`). The preload list reads it back.
 */
export type FontFiles = Readonly<Record<string, Readonly<Record<string, string>>>>

export const fontFilesSchema: z.ZodType<FontFiles> = z.record(z.string(), z.record(z.string(), z.string()))
