import type { HudFile, HudModel } from '@automata/hud'
import type { Hotspot } from '@automata/interact/sim'
import { objectiveNow } from '../features/objective/objective.ts'

/** What the sim and the screen reported this step, for the HUD: read by the model, never written by it. */
export interface PlayState {
  /** The puzzle's facts, the lamp's `lit` and `fuel` among them. */
  readonly facts: Readonly<Record<string, unknown>>
  readonly items: readonly string[]
  readonly held: string | undefined
  /** The hotspots within reach and usable, nearest first (`Interact.inReach`). */
  readonly inReach: readonly Hotspot[]
  readonly examine: HudModel['examine']
  readonly keypad: HudModel['keypad']
  /** A cutscene holds input (`cutscenes.locked`). */
  readonly locked: boolean
  readonly hotspots: readonly Hotspot[]
}

/** The key of an item's name and of its text: the prologue's item lines. */
const ITEM_NAME = (id: string): string => `prologue.item.${id}.name`
const ITEM_TEXT = (id: string): string => `prologue.item.${id}`

/** The HUD's model for this step. Pure: it only reads `state` and the HUD file. */
export function hudModelOf(state: PlayState, file: HudFile): HudModel {
  const objective = objectiveNow(
    file,
    { fact: (name) => state.facts[name] as never, has: (item) => state.items.includes(item) },
    state.hotspots,
  )
  const [nearest] = state.inReach
  return {
    objective: objective?.line,
    // A cutscene holds input: there is nothing to use, so nothing is offered.
    prompt: state.locked || nearest === undefined ? undefined : { at: nearest.id, name: nearest.name },
    items: state.items.map((id) => ({ id, name: ITEM_NAME(id), text: ITEM_TEXT(id) })),
    held: state.held,
    examine: state.examine,
    keypad: state.keypad,
    locked: state.locked,
  }
}
