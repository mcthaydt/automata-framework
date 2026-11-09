// The `figure-seat` content kind: every TOML file in `content/figure-seats` is one seat (a chair, a desk, a sofa).
// Seats are presentation, so they stay out of the sim's partition and hash like the rest of the figures' content.

import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import { type Seat, seatSchema } from './seat.schema.ts'

export const figureSeatContent: ContentSchemaDef<'figure-seat'> = defineContentSchema(
  'figure-seat',
  seatSchema,
  { folder: 'figure-seats' },
  { sim: false },
)
