// base-3d's commands (DESIGN.md §14.1): what the input layer sends the sim each fixed step. `camera-turn` is
// render-pixi3d's (M3 spec §4.2, one owner). Systems read only these and the world, never input devices.
import { STICK_MAX } from '@mcthaydt/automata-render-pixi3d/sim'
import { type CommandDef, defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const axis = z.int().min(-STICK_MAX).max(STICK_MAX)
const moveSchema = z.object({ x: axis, y: axis })

/** The stick this tick, quantized as `Input.stick()` gives it (M4-D2): −127..127 a side, y positive down. */
export type MoveInput = z.infer<typeof moveSchema>

/** Where the stick is. Sent every tick in play; no command is a centred stick. */
export const Move: CommandDef<typeof moveSchema> = defineCommand('move', moveSchema)

const lockSchema = z.object({ down: z.boolean() })

/** Whether the lock button is held: a press locks onto the nearest target, a release lets go (M3 spec §4.7). */
export const Lock: CommandDef<typeof lockSchema> = defineCommand('lock', lockSchema)
