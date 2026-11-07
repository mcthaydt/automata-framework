import { type CommandDef, defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const kickSchema: z.ZodObject<{ ball: z.ZodNumber; dvx: z.ZodNumber }> = z.object({
  ball: z.number().int(),
  dvx: z.number().int(),
})
/** Adds `dvx` to one ball's horizontal velocity. */
export const Kick: CommandDef<typeof kickSchema> = defineCommand('bounce.kick', kickSchema)
