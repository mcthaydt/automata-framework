// What narrative tells the presentation: the line a conversation says and the choices it offers,
// its end, and a storylet's line. Lines are ids whose text is a locale key, never text.
import { defineEvent, type EventDef } from '@automata/sim'
import { z } from 'zod'

export interface LinePayload {
  readonly graph: string
  readonly id: string
}
export const NarrativeLine: EventDef<z.ZodType<LinePayload>> = defineEvent(
  'narrative.line',
  z.strictObject({ graph: z.string(), id: z.string() }),
)
export interface ChoicesPayload {
  readonly graph: string
  /** By index in the node's own list, the one `narrative.choose` takes. */
  readonly choices: readonly { readonly index: number; readonly line: string }[]
}
export const NarrativeChoices: EventDef<z.ZodType<ChoicesPayload>> = defineEvent(
  'narrative.choices',
  z.strictObject({
    graph: z.string(),
    choices: z.array(z.strictObject({ index: z.number(), line: z.string() })),
  }),
)
export interface EndedPayload {
  readonly graph: string
}
export const NarrativeEnded: EventDef<z.ZodType<EndedPayload>> = defineEvent(
  'narrative.ended',
  z.strictObject({ graph: z.string() }),
)
export interface StoryletPayload {
  readonly id: string
  readonly line: string
}
export const NarrativeStorylet: EventDef<z.ZodType<StoryletPayload>> = defineEvent(
  'narrative.storylet',
  z.strictObject({ id: z.string(), line: z.string() }),
)
