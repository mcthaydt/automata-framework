// A scene change (M6 spec §5): the game's Flow hands the scene's narrative content to the sim. The stance bounds come
// from the canon (the default −4..4 when it gives none, NR-D2); the conversation under way and what the deck has played
// start again, as the source's new world did. Stance and the dialogue's facts carry over.
import type { SimContext } from '@mcthaydt/automata-sim'
import { type Canon, DEFAULT_STANCE } from './canon.schema'
import { type DialogueGraph, dialogueGraphSchema } from './dialogue.schema'
import { NarrativeDialogue, NarrativeSceneResource, NarrativeStorylets } from './narrative.resource'
import { type Storylet, storyletSchema } from './storylet.schema'

export interface NarrativeScene {
  readonly canon?: Canon | undefined
  readonly graphs: readonly DialogueGraph[]
  readonly storylets: readonly Storylet[]
}

/** Makes `scene` the scene's narrative. Call it from a game system; a graph or storylet that fails its schema throws. */
export function loadNarrative(ctx: SimContext, scene: NarrativeScene): void {
  // A system owns the resources it changes; the readonly types are for their readers.
  const loaded = ctx.resource(NarrativeSceneResource) as {
    bounds: { min: number; max: number }
    graphs: DialogueGraph[]
    deck: Storylet[]
  }
  const bounds = scene.canon?.stance ?? DEFAULT_STANCE
  loaded.bounds = { min: bounds.min, max: bounds.max }
  loaded.graphs = scene.graphs.map((g) => dialogueGraphSchema.parse(g))
  loaded.deck = scene.storylets.map((s) => storyletSchema.parse(s))
  const dialogue = ctx.resource(NarrativeDialogue)
  dialogue.graph = null
  dialogue.place = null
  dialogue.stance = Math.max(bounds.min, Math.min(bounds.max, dialogue.stance))
  Object.assign(ctx.resource(NarrativeStorylets), { played: {}, still: null, queued: null, room: null })
}
