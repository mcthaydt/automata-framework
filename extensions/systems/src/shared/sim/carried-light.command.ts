// Lighting a carried light, or putting it out.
import { type CommandDef, defineCommand } from '@automata/sim'
import { z } from 'zod'

const toggleSchema: z.ZodType<Record<string, never>> = z.strictObject({})
/** Lights every carried light that has fuel, or puts out those that are lit. One with no fuel stays dark and says so. */
export const ToggleLight: CommandDef<z.ZodType<Record<string, never>>> = defineCommand(
  'systems.light-toggle',
  toggleSchema,
)
