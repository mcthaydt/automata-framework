// A verb (M6 spec §4.5, §5): what the player did, sent by the game once its walker is in reach. `at` is a hotspot id or
// `combine`, `floor` or `code`; `held` the item in hand, `pair` two items combined, `code` a typed code, `point` a floor
// point.
import { type CommandDef, defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

export interface VerbPayload {
  readonly at: string
  readonly held?: string | undefined
  readonly pair?: readonly [string, string] | undefined
  readonly code?: string | undefined
  readonly point?: { readonly x: number; readonly z: number } | undefined
}

const verbSchema: z.ZodType<VerbPayload> = z.strictObject({
  at: z.string(),
  held: z.string().optional(),
  pair: z.tuple([z.string(), z.string()]).optional(),
  code: z.string().optional(),
  point: z.strictObject({ x: z.number(), z: z.number() }).optional(),
})

export const VerbCommand: CommandDef<z.ZodType<VerbPayload>> = defineCommand('puzzle.verb', verbSchema)
