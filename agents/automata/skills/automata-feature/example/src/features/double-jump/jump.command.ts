import { type CommandDef, defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

// Step 1 of the flow: the input. A command is the only way a player changes the sim; the input map sends one on
// the tick the jump button goes down.

const jumpSchema = z.object({})

export const Jump: CommandDef<typeof jumpSchema> = defineCommand('jump', jumpSchema)
