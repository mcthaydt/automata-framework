// Puzzle help (M6.8b): the owner's two puzzle-design rules as data. Every puzzle has three escalating hints (a nudge, a
// direction, then nearly the answer) woven into the world, and every important deduction about three clues from
// different places. `lintHelp` checks the counts and the places; the schema checks the shape and the references.
import { type Cond, condSchema } from '@mcthaydt/automata-puzzle/sim'
import { z } from 'zod'

/** One line in the world, and where the player meets it. */
export interface Clue {
  readonly line: string
  /** A hotspot id, or `cutscene:<id>`, `item:<id>`, `dialogue:<graph>` or `bark:<agent>`. */
  readonly at: string
}
export interface HintLadder {
  readonly id: string
  /** What the puzzle asks of the player, for docs and reviews. */
  readonly puzzle: string
  /** When it is solved (all hold). Ladders are in play order; only the last may omit it. */
  readonly done?: readonly Cond[] | undefined
  /** World lines from different places, escalating. */
  readonly levels: readonly Clue[]
}
/** Something the player must work out to solve a puzzle. */
export interface Deduction {
  readonly id: string
  readonly learn: string
  /** The hint ladders (puzzles) that need it. */
  readonly for: readonly string[]
  readonly clues: readonly Clue[]
}
export interface SceneHelp {
  readonly hints: readonly HintLadder[]
  readonly deductions: readonly Deduction[]
}
const clueSchema: z.ZodType<Clue> = z.strictObject({ line: z.string(), at: z.string() })
export const helpFileSchema: z.ZodType<SceneHelp> = z
  .strictObject({
    hints: z.array(
      z.strictObject({
        id: z.string().min(1),
        puzzle: z.string(),
        done: z.array(condSchema).optional(),
        levels: z.array(clueSchema),
      }),
    ),
    deductions: z.array(
      z.strictObject({
        id: z.string().min(1),
        learn: z.string(),
        for: z.array(z.string()),
        clues: z.array(clueSchema),
      }),
    ),
  })
  .superRefine((help, ctx) => {
    const seen = new Set<string>()
    help.hints.forEach((h, i) => {
      if (seen.has(h.id))
        ctx.addIssue({ code: 'custom', path: ['hints', i, 'id'], message: `ladder ${h.id} is listed twice` })
      seen.add(h.id)
    })
    help.deductions.forEach((d, i) => {
      d.for.forEach((f, j) => {
        if (!seen.has(f))
          ctx.addIssue({ code: 'custom', path: ['deductions', i, 'for', j], message: `no hint ladder ${f}` })
      })
    })
  })
