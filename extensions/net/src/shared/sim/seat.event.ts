import { defineEvent, type EventDef } from '@automata/sim'
import { z } from 'zod'
import { seatSchema } from './seat.schema'

/** The seat and the id of its seat entity. */
export interface SeatEntity {
  readonly seat: number
  readonly sid: number
}

const seatEntity: z.ZodType<SeatEntity> = z
  .object({ seat: seatSchema, sid: z.number().int().nonnegative() })
  .strict()

/** A player took a seat: its number and the id of the sim entity it owns. */
export const SeatJoined: EventDef<z.ZodType<SeatEntity>> = defineEvent('seat.joined', seatEntity)
/** A player left a seat: its number and the id of the sim entity it owned. */
export const SeatLeft: EventDef<z.ZodType<SeatEntity>> = defineEvent('seat.left', seatEntity)
