import { type CommandDef, defineCommand } from '@automata/sim'
import { z } from 'zod'

const cameraYawSchema: z.ZodType<{ units: number }> = z.object({ units: z.int() })

/**
 * The player turns the camera freely: an integer number of turn units (65,536 a turn), so a replay stores integers
 * only. Unlike `camera-turn`, which steps 45° a press, the heading turns by the units themselves (`yawCamera`), at most
 * 45° a tick: the analogue turn of an ordinary third-person game, from a right stick, a swipe or a mouse drag. A game
 * opts in by sending it; one that does not keeps the eight steps. Ignored in a view with `rotate: false`.
 */
export const CameraYaw: CommandDef<typeof cameraYawSchema> = defineCommand('camera-yaw', cameraYawSchema)
