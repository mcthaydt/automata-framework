// Nav's input: walk an entity to a point (click-to-walk), and open or shut a door.
import { type CommandDef, defineCommand } from '@automata/sim'
import { z } from 'zod'

export interface WalkToPayload {
  readonly entity: number
  readonly to: { readonly x: number; readonly z: number }
}
const walkToSchema: z.ZodType<WalkToPayload> = z.strictObject({
  entity: z.number().int().min(0),
  to: z.strictObject({ x: z.number(), z: z.number() }),
})
export const WalkTo: CommandDef<typeof walkToSchema> = defineCommand('nav.walk-to', walkToSchema)

export interface NavDoorPayload {
  readonly door: string
  readonly open: boolean
}
const doorSchema: z.ZodType<NavDoorPayload> = z.strictObject({ door: z.string(), open: z.boolean() })
export const NavDoor: CommandDef<typeof doorSchema> = defineCommand('nav.door', doorSchema)
