import { z } from 'zod'

/** Seats are 0 to MAX_SEATS - 1. Owned by the sim side, which the wire imports (the sim may not import the wire). */
export const MAX_SEATS = 16

/**
 * The sim `source` of the room's own commands (seat.join, seat.leave and a game's room commands): the highest source
 * the sim accepts, never a seat. On the sim side so a game's sim can tell the room's commands from a seat's without
 * importing the server; the server stamps its commands with this constant.
 */
export const ROOM_SOURCE = 255

/** A seat index, 0 to MAX_SEATS - 1. */
export const seatSchema: z.ZodType<number> = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_SEATS - 1)
