import { type CommandDef, defineCommand } from '@automataframework/automata-sim'
import { z } from 'zod'

const moveSchema = z.object({ x: z.union([z.literal(-1), z.literal(0), z.literal(1)]), jump: z.boolean() })

/** What the player is holding this tick: a direction and whether jump is down. Sent once per tick in the room. */
export type MoveInput = z.infer<typeof moveSchema>

export const Move: CommandDef<typeof moveSchema> = defineCommand('move', moveSchema)
