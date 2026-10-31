// base-3d's commands (DESIGN.md §14.1): what the input layer sends the sim each fixed step. `camera-turn` is
// render-pixi3d's (M3 spec §4.2, one owner). Systems read only these and the world, never input devices.
import { STICK_MAX } from '@mcthaydt/automata-render-pixi3d/sim'
import { type CommandDef, defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const axis = z.int().min(-STICK_MAX).max(STICK_MAX)
const moveSchema = z.object({ x: axis, y: axis })

/**
 * Where the stick is, quantized as `Input.stick()` gives it (M4-D2): −127..127 a side, y positive down. Sent every
 * tick in play; no command is a centred stick.
 */
export const Move: CommandDef<typeof moveSchema> = defineCommand('move', moveSchema)

const lockSchema = z.object({ down: z.boolean(), mode: z.enum(['toggle', 'hold']) })

/**
 * Whether the lock button is held, and the player's Lock mode (DESIGN.md §11.1, §12.2), which reaches the sim as
 * command data, never as a settings read. A press locks onto a target (or recentres the camera with none); in
 * toggle mode the next press lets go, in hold mode the release does.
 */
export const Lock: CommandDef<typeof lockSchema> = defineCommand('lock', lockSchema)

const lockCycleSchema = z.object({ dir: z.union([z.literal(1), z.literal(-1)]) })

/** While locked, move the lock to the next target around Wick: 1 clockwise seen from above, −1 anticlockwise. */
export const LockCycle: CommandDef<typeof lockCycleSchema> = defineCommand('lock-cycle', lockCycleSchema)

const actSchema = z.object({
  slash: z.boolean(),
  guard: z.boolean(),
  point: z.boolean(),
  pickup: z.boolean(),
  /** The Action button (DESIGN.md §14.1 `action`): a roll, or a hop while locked. */
  action: z.boolean(),
  /** The Item button (DESIGN.md §14.1 `item`): held to draw the sling, let go to fire (GAME-3D.1e). */
  item: z.boolean(),
})

/**
 * Which action buttons are held, sent every tick in play as `lock` is: a press of slash, point or pickup starts
 * that action, guard is held as a stance (M3 spec §4.7), and Action rolls or hops (DESIGN.md §7.2). No command is
 * every button up. GAME-3D.1h splits it into §14.1's `attack`, `shield` and `action`.
 */
export const Act: CommandDef<typeof actSchema> = defineCommand('act', actSchema)
