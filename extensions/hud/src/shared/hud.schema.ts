// The `hud` file: the layout of the play HUD and the rows that choose its objective line. It is the hand-over to the
// coming UI editor, so it is data with a schema, never code: where each piece sits, how big it may be, which words it shows.
import { z } from 'zod'
import { type HudLayout, piecesSchema } from './layout.schema'
import { type ObjectiveRow, objectiveRowSchema } from './objective'

export interface HudFile extends HudLayout {
  /** The rows that choose the objective line, first match wins. */
  readonly objective?: readonly ObjectiveRow[] | undefined
}

export const hudSchema: z.ZodType<HudFile> = z.strictObject({
  pieces: piecesSchema,
  objective: z.array(objectiveRowSchema).optional(),
})
