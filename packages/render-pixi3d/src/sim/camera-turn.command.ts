import { type CommandDef, defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const cameraTurnSchema: z.ZodType<{ units: number }> = z.object({ units: z.int() })

/**
 * The player turns the camera by `units` (M3 spec §4.2): an integer, 65,536 to a turn, so a replay stores integers
 * only. The input layer makes it from a drag, the right stick or held keys; the sim clamps a tick's total to
 * ±8,192 (45°) and ignores it in a view with `rotate: false`.
 */
export const CameraTurn: CommandDef<typeof cameraTurnSchema> = defineCommand('camera-turn', cameraTurnSchema)
