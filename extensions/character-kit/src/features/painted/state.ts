// What a painted figure is doing, and the check that its names are real. Pure, so it runs in Node: the figure itself needs
// Pixi and a render, but a typo in a pose or outfit name should fail with words, at the first frame, not draw a standing
// figure and say nothing.
import { type CharacterDef, POSES } from '../../shared/figures/door.ts'

/** What a painted figure is doing this frame. */
export interface PaintedState {
  /** Walking, or standing. */
  readonly moving: boolean
  /** A stand held while it is not moving: a name in the builder's `POSES` (a hand in a pocket, arms folded, and so on). */
  readonly pose?: string | undefined
  /** The outfit worn: one of the character's own, its default outfit when left out. */
  readonly outfit?: string | undefined
}

/** Throws, naming the character and the name, when `state` asks for a pose the builder does not have or an outfit the
 * character does not wear. */
export function checkState(def: CharacterDef, state: PaintedState): void {
  if (state.pose !== undefined && !(state.pose in POSES)) {
    throw new Error(
      `No pose called "${state.pose}" (asked of ${def.id}). The poses are: ${Object.keys(POSES).join(', ')}.`,
    )
  }
  if (state.outfit !== undefined && !(state.outfit in def.outfits)) {
    throw new Error(
      `${def.id} has no outfit called "${state.outfit}". Its outfits are: ${Object.keys(def.outfits).join(', ')}.`,
    )
  }
}
