import { type CommandDef, defineCommand } from '@automataframework/sim'
import { z } from 'zod'

const cameraTurnSchema: z.ZodType<{ units: number }> = z.object({ units: z.int() })

/**
 * The player turns the camera: an integer, so a replay stores integers only. Its sign picks the direction (Q and R,
 * a swipe, the bumpers); the sim turns one 45° step toward the tick's total, however large it is, and ignores it in a
 * view with `rotate: false`.
 */
export const CameraTurn: CommandDef<typeof cameraTurnSchema> = defineCommand('camera-turn', cameraTurnSchema)
