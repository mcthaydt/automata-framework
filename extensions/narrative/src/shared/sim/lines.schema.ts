// Line records: every line a scene says, with what it means for the story. `text` is a locale key
//: the sim holds the key, and the string exists only on screen.
import { z } from 'zod'

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
  /** Canon fact ids this line states. */
  readonly facts?: readonly string[] | undefined
  readonly beat?: string | undefined
  /** Lethal or systemic rule ids this line hints at. */
  readonly hints?: readonly string[] | undefined
  readonly motifs?: readonly string[] | undefined
}
export const lineSchema: z.ZodType<LineRecord> = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(LINE_KINDS as [LineKind, ...LineKind[]]),
  speaker: z.string().optional(),
  text: z.string().min(1),
  facts: z.array(z.string()).optional(),
  beat: z.string().optional(),
  hints: z.array(z.string()).optional(),
  motifs: z.array(z.string()).optional(),
})
export interface LinesFile {
  readonly lines: readonly LineRecord[]
}
export const linesFileSchema: z.ZodType<LinesFile> = z
  .strictObject({ lines: z.array(lineSchema) })
  .superRefine((file, ctx) => {
    const seen = new Set<string>()
    file.lines.forEach((l, i) => {
      if (seen.has(l.id))
        ctx.addIssue({ code: 'custom', path: ['lines', i, 'id'], message: `line ${l.id} is listed twice` })
      seen.add(l.id)
    })
  })
