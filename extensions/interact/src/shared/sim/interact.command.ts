// What a person does with a hotspot: use it (the walker goes there first), combine two items, enter a code, or change
// their mind.
import { type CommandDef, defineCommand } from '@automataframework/sim'
import { z } from 'zod'

export interface UsePayload {
  readonly at: string
  readonly held?: string | undefined
}
const useSchema: z.ZodType<UsePayload> = z.strictObject({ at: z.string(), held: z.string().optional() })
/** Use the hotspot `at`, with `held` in hand. The walk to it is `nav.walk-to`, sent in the same tick by the game. */
export const Use: CommandDef<z.ZodType<UsePayload>> = defineCommand('interact.use', useSchema)

export interface CombinePayload {
  readonly a: string
  readonly b: string
}
const combineSchema: z.ZodType<CombinePayload> = z.strictObject({ a: z.string(), b: z.string() })
/** Combine two carried items; there is nowhere to walk to, so it happens at once. */
export const Combine: CommandDef<z.ZodType<CombinePayload>> = defineCommand('interact.combine', combineSchema)

export interface EnterCodePayload {
  readonly code: string
}
const codeSchema: z.ZodType<EnterCodePayload> = z.strictObject({ code: z.string() })
/** Enter a code at the keypad. */
export const EnterCode: CommandDef<z.ZodType<EnterCodePayload>> = defineCommand('interact.code', codeSchema)

const cancelSchema: z.ZodType<Record<string, never>> = z.strictObject({})
/** Drop the use that is waiting for the walker. */
export const Cancel: CommandDef<z.ZodType<Record<string, never>>> = defineCommand(
  'interact.cancel',
  cancelSchema,
)
