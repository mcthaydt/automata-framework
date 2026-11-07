// Narrative's sim state (M6 spec §4.7, §4.13): the scene's content as loaded (the canon's stance bounds, the graphs and
// the deck), the conversation under way, what the deck has played, and the player it follows (NR-D5).
import { type Value, valueSchema } from '@mcthaydt/automata-puzzle/sim'
import { defineResource, type ResourceDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'
import { DEFAULT_STANCE } from './canon.schema'
import type { DialogueState, Place } from './dialogue'
import { type DialogueGraph, dialogueGraphSchema } from './dialogue.schema'
import { type Storylet, storyletSchema } from './storylet.schema'
import type { StoryletState } from './storylets'

export interface NarrativeSceneValue {
  bounds: { min: number; max: number }
  graphs: DialogueGraph[]
  deck: Storylet[]
}
export const NarrativeSceneResource: ResourceDef<z.ZodType<NarrativeSceneValue>> = defineResource(
  'narrative.scene',
  z.strictObject({
    bounds: z.strictObject({ min: z.number(), max: z.number() }),
    graphs: z.array(dialogueGraphSchema),
    deck: z.array(storyletSchema),
  }) as z.ZodType<NarrativeSceneValue>,
  () => ({ bounds: { ...DEFAULT_STANCE }, graphs: [], deck: [] }),
)

const placeSchema: z.ZodType<Place> = z.strictObject({ node: z.string(), line: z.number().int() })

export interface NarrativeDialogueValue {
  /** The graph under way, or null. */
  graph: string | null
  place: Place | null
  stance: DialogueState['stance']
  facts: Record<string, Value>
}
/** The conversation under way, and what choices have changed (kept between conversations, as in the source). */
export const NarrativeDialogue: ResourceDef<z.ZodType<NarrativeDialogueValue>> = defineResource(
  'narrative.dialogue',
  z.strictObject({
    graph: z.string().nullable(),
    place: placeSchema.nullable(),
    stance: z.number(),
    facts: z.record(z.string(), valueSchema),
  }) as z.ZodType<NarrativeDialogueValue>,
  () => ({ graph: null, place: null, stance: 0, facts: {} }),
)

const roomSchema = z.strictObject({ sector: z.string(), zone: z.string() })
export const NarrativeStorylets: ResourceDef<z.ZodType<StoryletState>> = defineResource(
  'narrative.storylets',
  z.strictObject({
    played: z.record(z.string(), z.number().int()),
    still: z.number().nullable(),
    queued: z.strictObject({ id: z.string(), at: z.number().int() }).nullable(),
    room: roomSchema.nullable(),
  }),
  () => ({ played: {}, still: null, queued: null, room: null }),
)

export interface NarrativeEnvValue {
  /** The player's StableId, set by the game (NR-D5). */
  player: number | null
  /** Its plan position last step, to tell standing still from moving. */
  last: { x: number; z: number } | null
}
export const NarrativeEnv: ResourceDef<z.ZodType<NarrativeEnvValue>> = defineResource(
  'narrative.env',
  z.strictObject({
    player: z.number().int().nullable(),
    last: z.strictObject({ x: z.number(), z: z.number() }).nullable(),
  }),
  () => ({ player: null, last: null }),
)
