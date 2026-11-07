// What a cutscene tells the presentation (M6 spec §4.8, §5): it started, with the ticks it runs between, or it ended, played
// out or skipped. A script skipped because an anchor was missing ends without starting, naming the anchors (CS-D2).
import { defineEvent, type EventDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

export interface StartedPayload {
  readonly id: string
  readonly start: number
  readonly end: number
}
export const CutsceneStarted: EventDef<z.ZodType<StartedPayload>> = defineEvent(
  'cutscene.started',
  z.strictObject({ id: z.string(), start: z.number().int(), end: z.number().int() }),
)
export interface EndedPayload {
  readonly id: string
  /** Skipped by a `cutscene.skip`, by a script that replaced it, or because an anchor was missing. */
  readonly skipped: boolean
  /** The anchors the scene could not resolve; empty unless the script never started. */
  readonly missing: readonly string[]
}
export const CutsceneEnded: EventDef<z.ZodType<EndedPayload>> = defineEvent(
  'cutscene.ended',
  z.strictObject({ id: z.string(), skipped: z.boolean(), missing: z.array(z.string()) }),
)
