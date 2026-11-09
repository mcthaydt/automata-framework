import { type CommandDef, defineCommand } from '@automata/sim'
import { z } from 'zod'
import { seatSchema } from './seat.schema'

/** Which seat. */
export interface SeatPayload {
  readonly seat: number
}

const seatPayload: z.ZodType<SeatPayload> = z.object({ seat: seatSchema }).strict()

/** Sent by the room when a seat is taken (a player or a bot). Commands are `seat.join`; the events say `joined`. */
export const SeatJoin: CommandDef<z.ZodType<SeatPayload>> = defineCommand('seat.join', seatPayload)

/** Sent by the room when a seat is given up (a leave, or a drop past the reconnect grace). */
export const SeatLeave: CommandDef<z.ZodType<SeatPayload>> = defineCommand('seat.leave', seatPayload)
