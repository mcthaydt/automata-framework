// The canon's shape (M6 spec §4.7): what a game's story bible holds as data. The text is the game's content; the
// stance bounds are what the dialogue clamps to (NR-D2, M6.3's `STANCE` fix).
import { z } from 'zod'

export interface Canon {
  readonly people: Readonly<
    Record<string, { readonly name: string; readonly short?: string | undefined; readonly role: string }>
  >
  readonly places: Readonly<Record<string, string>>
  readonly times: Readonly<Record<string, string>>
  readonly numbers: Readonly<Record<string, string>>
  readonly facts: readonly {
    readonly id: string
    readonly text: string
    readonly revealedIn: readonly string[]
  }[]
  readonly tone: { readonly banned: readonly string[]; readonly style: string }
  readonly glossary: readonly string[]
  readonly motifs?: readonly string[] | undefined
  /** The stance axis: the low end is vigil, the high end release. */
  readonly stance?: { readonly min: number; readonly max: number } | undefined
}
export const canonSchema: z.ZodType<Canon> = z
  .strictObject({
    people: z.record(
      z.string(),
      z.strictObject({ name: z.string(), short: z.string().optional(), role: z.string() }),
    ),
    places: z.record(z.string(), z.string()),
    times: z.record(z.string(), z.string()),
    numbers: z.record(z.string(), z.string()),
    facts: z.array(z.strictObject({ id: z.string(), text: z.string(), revealedIn: z.array(z.string()) })),
    tone: z.strictObject({ banned: z.array(z.string()), style: z.string() }),
    glossary: z.array(z.string()),
    motifs: z.array(z.string()).optional(),
    stance: z.strictObject({ min: z.number(), max: z.number() }).optional(),
  })
  .superRefine((canon, ctx) => {
    if (canon.stance !== undefined && !(canon.stance.min <= canon.stance.max))
      ctx.addIssue({
        code: 'custom',
        path: ['stance'],
        message: `stance min ${canon.stance.min} is above max ${canon.stance.max}`,
      })
  })

/** The stance bounds when a canon gives none (the source's default). */
export const DEFAULT_STANCE: { readonly min: number; readonly max: number } = { min: -4, max: 4 }
