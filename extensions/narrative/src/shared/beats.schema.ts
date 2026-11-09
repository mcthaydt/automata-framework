// Beats: what the player must, or may, learn, and the line records that
// deliver it. The coverage tool checks a beat against the routes the solver finds.
import { z } from 'zod'

export interface Beat {
  readonly id: string
  /** What the player learns. */
  readonly learn: string
  /** A required beat is delivered on every solution route. */
  readonly required: boolean
  /** Line ids that deliver it. */
  readonly deliveredBy: readonly string[]
  /** Beats that must come first. */
  readonly after?: readonly string[] | undefined
}
export const beatSchema: z.ZodType<Beat> = z.strictObject({
  id: z.string().min(1),
  learn: z.string(),
  required: z.boolean(),
  deliveredBy: z.array(z.string()),
  after: z.array(z.string()).optional(),
})
export interface BeatsFile {
  readonly beats: readonly Beat[]
}
export const beatsFileSchema: z.ZodType<BeatsFile> = z
  .strictObject({ beats: z.array(beatSchema) })
  .superRefine((file, ctx) => {
    const seen = new Set<string>()
    file.beats.forEach((b, i) => {
      if (seen.has(b.id))
        ctx.addIssue({ code: 'custom', path: ['beats', i, 'id'], message: `beat ${b.id} is listed twice` })
      seen.add(b.id)
    })
    file.beats.forEach((b, i) => {
      ;(b.after ?? []).forEach((a, j) => {
        if (!seen.has(a))
          ctx.addIssue({ code: 'custom', path: ['beats', i, 'after', j], message: `no beat ${a}` })
      })
    })
  })
