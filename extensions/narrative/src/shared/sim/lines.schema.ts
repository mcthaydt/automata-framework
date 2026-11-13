// Line records: every line a scene says, with what it means for the story. `text` is a locale key
//: the sim holds the key, and the string exists only on screen.
import { z } from 'zod'
import { type Delivery, deliveryProblems, deliverySchema } from './delivery.ts'

export type LineKind =
  | 'examine'
  | 'item'
  | 'bark'
  | 'caption'
  | 'note'
  | 'objective'
  | 'caught'
  | 'dialogue'
  | 'file'
export const LINE_KINDS: readonly LineKind[] = [
  'examine',
  'item',
  'bark',
  'caption',
  'note',
  'objective',
  'caught',
  'dialogue',
  'file',
]
export interface LineRecord {
  /** `<scene>.<name>`. */
  readonly id: string
  readonly kind: LineKind
  readonly speaker?: string | undefined
  /** The locale key of the line's text. */
  readonly text: string
  /**
   * What the line says, in the game's source language. The sim never reads it; the content kind marks it as
   * translatable text and `wordsOf` hands it to the dialogue box.
   */
  readonly words?: string | undefined
  /** Canon fact ids this line states. */
  readonly facts?: readonly string[] | undefined
  readonly beat?: string | undefined
  /** Lethal or systemic rule ids this line hints at. */
  readonly hints?: readonly string[] | undefined
  readonly motifs?: readonly string[] | undefined
  /** How the line is said: absent means plainly. A direction, a pace and pauses by sentence. */
  readonly delivery?: Delivery | undefined
}
/**
 * A line's `words` as plain text, whichever schema read it. The sim's schema gives a string; the content kind's marks the
 * words as translatable, so while the line is being checked `words` is a marker holding the text (the compiler puts the
 * string back once the file is valid).
 */
function plainWords(words: unknown): string | undefined {
  if (typeof words === 'string') return words
  const text = (words as { readonly text?: unknown } | null | undefined)?.text
  return typeof text === 'string' ? text : undefined
}

/** The line's shape; the content kind passes its own schema for `words` (translatable text), the sim plain text. */
function lineShape(words: z.ZodType<string, string>): z.ZodType<LineRecord> {
  return z
    .strictObject({
      id: z.string().min(1),
      kind: z.enum(LINE_KINDS as [LineKind, ...LineKind[]]),
      speaker: z.string().optional(),
      text: z.string().min(1),
      words: words.optional(),
      facts: z.array(z.string()).optional(),
      beat: z.string().optional(),
      hints: z.array(z.string()).optional(),
      motifs: z.array(z.string()).optional(),
      delivery: deliverySchema.optional(),
    })
    .superRefine((line, context) => {
      for (const message of deliveryProblems(line.id, line.delivery, plainWords(line.words)))
        context.addIssue({ code: 'custom', path: ['delivery', 'beats'], message })
    })
}
export const lineSchema: z.ZodType<LineRecord> = lineShape(z.string())
export interface LinesFile {
  readonly lines: readonly LineRecord[]
}
/** A lines file whose `words` are checked by `words`; no line id is listed twice. */
export function linesFileSchemaWith(words: z.ZodType<string, string>): z.ZodType<LinesFile> {
  return z.strictObject({ lines: z.array(lineShape(words)) }).superRefine((file, ctx) => {
    const seen = new Set<string>()
    file.lines.forEach((l, i) => {
      if (seen.has(l.id))
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'id'], message: `line ${l.id} is listed twice` })
      seen.add(l.id)
    })
  })
}
export const linesFileSchema: z.ZodType<LinesFile> = linesFileSchemaWith(z.string())
