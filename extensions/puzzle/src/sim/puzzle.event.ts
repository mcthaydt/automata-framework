// What a verb did (M6 spec §4.5). `puzzle.said` carries the line key and the items gained, never text: names and lines
// are the game's presentation (P6-D3). The effects that belong to other extensions are events those extensions read:
// `puzzle.noise` (systems), `puzzle.cutscene` and `puzzle.exit` (cutscenes and the game's Flow), `puzzle.dialogue`
// (narrative); `puzzle.checkpoint` and `puzzle.keypad` are the game's.
import { defineEvent, type EventDef } from '@automata/sim'
import { z } from 'zod'

type Empty = Record<string, never>
const empty: z.ZodType<Empty> = z.strictObject({})

export interface SaidPayload {
  /** The action applied, or null for a fallback line. */
  readonly action: string | null
  readonly at: string
  readonly line: string
  readonly gained: readonly string[]
}
const saidSchema: z.ZodType<SaidPayload> = z.strictObject({
  action: z.string().nullable(),
  at: z.string(),
  line: z.string(),
  gained: z.array(z.string()),
})
export const PuzzleSaid: EventDef<z.ZodType<SaidPayload>> = defineEvent('puzzle.said', saidSchema)

export interface GavePayload {
  readonly item: string
}
const gaveSchema: z.ZodType<GavePayload> = z.strictObject({ item: z.string() })
export const PuzzleGave: EventDef<z.ZodType<GavePayload>> = defineEvent('puzzle.gave', gaveSchema)
export const PuzzleGoal: EventDef<z.ZodType<Empty>> = defineEvent('puzzle.goal', empty)

export interface NoisePayload {
  readonly at: { readonly x: number; readonly z: number }
  readonly loudness: number
  readonly kind: string
}
const noiseSchema: z.ZodType<NoisePayload> = z.strictObject({
  at: z.strictObject({ x: z.number(), z: z.number() }),
  loudness: z.number(),
  kind: z.string(),
})
export const PuzzleNoise: EventDef<z.ZodType<NoisePayload>> = defineEvent('puzzle.noise', noiseSchema)

export interface IdPayload {
  readonly id: string
}
const idSchema: z.ZodType<IdPayload> = z.strictObject({ id: z.string() })
export const PuzzleCutscene: EventDef<z.ZodType<IdPayload>> = defineEvent('puzzle.cutscene', idSchema)
export const PuzzleDialogue: EventDef<z.ZodType<IdPayload>> = defineEvent('puzzle.dialogue', idSchema)

export interface ExitPayload {
  readonly to: string
  readonly cutscene: string
}
const exitSchema: z.ZodType<ExitPayload> = z.strictObject({ to: z.string(), cutscene: z.string() })
export const PuzzleExit: EventDef<z.ZodType<ExitPayload>> = defineEvent('puzzle.exit', exitSchema)
export const PuzzleCheckpoint: EventDef<z.ZodType<Empty>> = defineEvent('puzzle.checkpoint', empty)
export const PuzzleKeypad: EventDef<z.ZodType<Empty>> = defineEvent('puzzle.keypad', empty)
