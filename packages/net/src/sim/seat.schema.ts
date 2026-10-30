import { z } from 'zod'

/** Seats are 0 to MAX_SEATS - 1. Owned by the sim side, which the wire imports (the sim may not import the wire). */
export const MAX_SEATS = 16

/** A seat index, 0 to MAX_SEATS - 1. */
export const seatSchema: z.ZodType<number> = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_SEATS - 1)
