// What the systems tell the game: an agent changed mode, a noise was made, the player was caught, a cutscene starts,
// a line is said. Text is the game's (a line is a key).
import { defineEvent, type EventDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

export interface ModePayload {
  readonly agent: string
  readonly from: string
  readonly to: string
}
const modeSchema: z.ZodType<ModePayload> = z.strictObject({
  agent: z.string(),
  from: z.string(),
  to: z.string(),
})
export const SystemsMode: EventDef<z.ZodType<ModePayload>> = defineEvent('systems.mode', modeSchema)

export interface SystemsNoisePayload {
  readonly at: { readonly x: number; readonly z: number }
  readonly loudness: number
  readonly kind: string
}
const noiseSchema: z.ZodType<SystemsNoisePayload> = z.strictObject({
  at: z.strictObject({ x: z.number(), z: z.number() }),
  loudness: z.number(),
  kind: z.string(),
})
export const SystemsNoise: EventDef<z.ZodType<SystemsNoisePayload>> = defineEvent(
  'systems.noise',
  noiseSchema,
)

export interface CaughtPayload {
  readonly cause: string
}
const caughtSchema: z.ZodType<CaughtPayload> = z.strictObject({ cause: z.string() })
export const SystemsCaught: EventDef<z.ZodType<CaughtPayload>> = defineEvent('systems.caught', caughtSchema)

export interface CutscenePayload {
  readonly id: string
}
const cutsceneSchema: z.ZodType<CutscenePayload> = z.strictObject({ id: z.string() })
export const SystemsCutscene: EventDef<z.ZodType<CutscenePayload>> = defineEvent(
  'systems.cutscene',
  cutsceneSchema,
)

export interface LinePayload {
  /** The agent that says it, or `world` for a world rule. */
  readonly by: string
  readonly line: string
}
const lineSchema: z.ZodType<LinePayload> = z.strictObject({ by: z.string(), line: z.string() })
export const SystemsLine: EventDef<z.ZodType<LinePayload>> = defineEvent('systems.line', lineSchema)
