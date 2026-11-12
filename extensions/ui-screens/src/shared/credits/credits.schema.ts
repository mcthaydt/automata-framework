// The credits file: sections of names. A name may carry a role and a link. The shapes are written out here and again
// in `CreditsPanel.svelte`, because a screen's folder may not import from the rest of the package (a game copies it
// alone); a test mounts the panel with a `Credits` value, so the two cannot drift.
import { z } from 'zod'

/** One person or group in a credits section. */
export interface CreditName {
  /** Who they are. A name is not translated. */
  readonly name: string
  /** What they did, in the source language; `automata words` translates it. */
  readonly role?: string | undefined
  /** Where to read more: an `https:` address, opened by the host. */
  readonly url?: string | undefined
}

/** A heading and the names under it. */
export interface CreditsSection {
  /** The heading, in the source language; `automata words` translates it. */
  readonly title: string
  readonly names: readonly CreditName[]
}

/** What a game's credits file holds. */
export interface Credits {
  readonly sections: readonly CreditsSection[]
}

/**
 * An address a host may be asked to open: `https:`, a host name, no name or password in it. The host's own rule
 * (`Hosting.openLink`) is the same, so a link the file accepts is one every target can open.
 */
const link = z.string().refine(
  (value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === ''
    } catch {
      return false
    }
  },
  { message: 'a link must be an https address with no name or password in it' },
)

/**
 * The Zod schema of a credits file, with section titles and roles checked by `text`: plain text here, translatable
 * text in the content kind. A name is checked by `name` (plain text by default; the content kind marks it `verbatim()`
 * so the font build holds it to every language's faces). Strict: a field it does not know is an error, so a misspelt `url` is found at compile time.
 */
export const creditsSchemaWith = (
  text: z.ZodType<string, string>,
  name: z.ZodType<string, string> = z.string().min(1),
): z.ZodType<Credits> =>
  z.strictObject({
    sections: z
      .array(
        z.strictObject({
          title: text,
          names: z
            .array(
              z.strictObject({
                name,
                role: text.optional(),
                url: link.optional(),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
  })

/** The Zod schema of a credits file. At least one section, and one name in each. */
export const creditsSchema: z.ZodType<Credits> = creditsSchemaWith(z.string().min(1))
