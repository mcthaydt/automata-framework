import { z } from 'zod'
import { COMMAND_TYPE_MAX_LENGTH, PLAYER_NAME_MAX_LENGTH, REQUEST_ID_MAX_LENGTH } from './limits'

/** A whole number from 0. */
export const uintSchema: z.ZodType<number> = z.number().int().nonnegative()

export { seatSchema } from '../sim/seat.schema'

/** A sim hash on the wire: 16 lower-case hex characters, as `Sim.hash()` writes it. */
export const hex16Schema: z.ZodType<string> = z
  .string()
  .regex(/^[0-9a-f]{16}$/, 'a hash is 16 lower-case hex characters')

/**
 * The only player-authored string on the wire (FloorFifty's `playerNameSchema`): letters, digits, spaces, hyphens
 * and underscores, so no later consumer (nameplate, roster, results row) needs an escaping rule of its own.
 */
export const nameSchema: z.ZodType<string> = z
  .string()
  .trim()
  .min(1, 'name must not be empty')
  .max(PLAYER_NAME_MAX_LENGTH, `name must be at most ${PLAYER_NAME_MAX_LENGTH} characters`)
  .regex(/^[\p{L}\p{N} _-]+$/u, 'name may contain only letters, digits, spaces, hyphens and underscores')

/**
 * A client-chosen correlation id (FloorFifty's `requestIdSchema`): printable ASCII, bounded. It addresses an
 * answer and grants no authority; nothing branches on its value.
 */
export const reqIdSchema: z.ZodType<string> = z
  .string()
  .min(1)
  .max(REQUEST_ID_MAX_LENGTH)
  .regex(/^[\x20-\x7e]+$/, 'a request id must be printable ASCII')

/** A sim command id, in the sim's own id form (lower-case words separated by dots or dashes). */
export const commandTypeSchema: z.ZodType<string> = z
  .string()
  .max(COMMAND_TYPE_MAX_LENGTH)
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'a command type is a sim command id')
