// `content/fonts.toml`: each source font by name, committed by the game, with the
// sha256 of its bytes, its licence and the content languages it serves. There is no url:
// AF never fetches a font.
//
//   [font.pixel]
//   file = "fonts/pixelify-sans-latin-400.woff2"   # relative to the project root
//   sha256 = "d830…"
//   license = "OFL-1.1"
//   locales = ["en", "fr"]
//   reserved_name = "Pixelify"                     # optional: the licence reserves this name, so a subset is renamed
//   license_file = "fonts/OFL.txt"                 # optional: shipped beside the subsets
import { z } from 'zod'

/** One source font: its committed file, the sha256 of its bytes, its licence and the languages it serves. */
export interface FontSource {
  readonly file: string
  readonly sha256: string
  readonly license: string
  readonly locales: readonly string[]
  /** A name the licence reserves (the OFL's Reserved Font Name): a subset is renamed `<font> <language>` and may not keep it. */
  readonly reserved_name?: string | undefined
  /** The licence text, relative to the project root; the build copies it beside the subsets. */
  readonly license_file?: string | undefined
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
      reserved_name: z.string().min(1).optional(),
      license_file: z.string().min(1).optional(),
    }),
  ),
})

/**
 * `fonts.json`, which `buildFonts` writes beside the subsets: for each font, its subset file for each language
 * (`{ "pixel": { "en": "pixel-en-0123abcd.woff2" } }`). The preload list reads it back.
 */
export type FontFiles = Readonly<Record<string, Readonly<Record<string, string>>>>

export const fontFilesSchema: z.ZodType<FontFiles> = z.record(z.string(), z.record(z.string(), z.string()))
