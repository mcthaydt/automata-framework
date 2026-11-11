// The objective line: an ordered list in the `hud` file, where the old game had nine `if`s. The first row whose
// conditions all hold is the line, and it may name a place to walk to. Conditions are the puzzle's, read through the
// same `Reader` the puzzle reads, so a fact has one owner.
import { type Cond, condSchema, holds, type Reader } from '@automata/puzzle/sim'
import { z } from 'zod'

export interface ObjectiveRow {
  /** Every condition must hold; none means always. */
  readonly when: readonly Cond[]
  /** A message key. */
  readonly line: string
  /** A hotspot or place the line points to. */
  readonly target?: string | undefined
}

export const objectiveRowSchema: z.ZodType<ObjectiveRow> = z.strictObject({
  when: z.array(condSchema),
  line: z.string().min(1),
  target: z.string().optional(),
})

/** The first row whose conditions all hold, or undefined when none does. */
export function chooseObjective(rows: readonly ObjectiveRow[], reader: Reader): ObjectiveRow | undefined {
  return rows.find((row) => row.when.every((condition) => holds(reader, { at: '' }, condition)))
}
