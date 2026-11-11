// A verb: what the player did, sent by the game once its walker is in reach. `at` is a hotspot id or
// `combine`, `floor` or `code`; `held` the item in hand, `pair` two items combined, `code` a typed code, `point` a floor
// point.
import { type CommandDef, defineCommand } from '@automata/sim'
import { z } from 'zod'

/** What a `puzzle.verb` carries, and what `applyVerb` takes: where the verb is aimed and what it holds, combines or types. */
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

/**
 * A verb: what the player did, sent by the game once its walker is in reach. `at` is a hotspot id,
 * or `combine`, `floor` or `code`; `held` is the item in hand, `pair` two items combined, `code` a
 * typed code and `point` a floor point.
 */
export const VerbCommand: CommandDef<z.ZodType<VerbPayload>> = defineCommand('puzzle.verb', verbSchema)
