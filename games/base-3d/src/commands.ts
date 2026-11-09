// base-3d's commands: what the input layer sends the sim each fixed step. `camera-turn` is render-pixi3d's (M3 spec
// §4.2, one owner). Systems read only these and the world, never input devices.
import { STICK_MAX } from '@automata/render-pixi3d/sim'
import { type CommandDef, defineCommand } from '@automata/sim'
import { z } from 'zod'

const axis = z.int().min(-STICK_MAX).max(STICK_MAX)
const moveSchema = z.object({ x: axis, y: axis })

/**
 * Where the stick is, quantized as `Input.stick()` gives it (M4-D2): −127..127 a side, y positive down. Sent every
 * tick in play; no command is a centred stick.
 */
export const Move: CommandDef<typeof moveSchema> = defineCommand('move', moveSchema)

const actSchema = z.object({ roll: z.boolean() })

/** Whether the roll button is held, sent every tick in play. No command is the button up. */
export const Act: CommandDef<typeof actSchema> = defineCommand('act', actSchema)
