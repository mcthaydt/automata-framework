import { defineEvent, type EventDef } from '@mcthaydt/automata-sim'
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

export const SeatJoined: EventDef<z.ZodType<SeatEntity>> = defineEvent('seat.joined', seatEntity)
export const SeatLeft: EventDef<z.ZodType<SeatEntity>> = defineEvent('seat.left', seatEntity)
