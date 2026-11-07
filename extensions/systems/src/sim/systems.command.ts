// Hiding (SY-D7): the player goes into a hiding place where she stands, or comes out. Moving brings her out too.
import { type CommandDef, defineCommand } from '@automata/sim'
import { z } from 'zod'

export interface HidePayload {
  readonly spot: string
}
const hideSchema: z.ZodType<HidePayload> = z.strictObject({ spot: z.string().min(1) })
export const Hide: CommandDef<typeof hideSchema> = defineCommand('systems.hide', hideSchema)

const unhideSchema: z.ZodType<Record<string, never>> = z.strictObject({})
export const Unhide: CommandDef<typeof unhideSchema> = defineCommand('systems.unhide', unhideSchema)
