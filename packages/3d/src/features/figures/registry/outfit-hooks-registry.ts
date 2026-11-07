// The outfit hooks (H2): what an extension tunes in `dress` without editing it. Both are callbacks core never
// sets. They are set once, by the one extension that owns the look of an outfit (a wardrobe); a second set fails.

import type { Part } from '../body/mesh.ts'
import type { Swatch } from '../content/swatch.schema.ts'
import type { Anchor } from '../figure/anchors.ts'
import type { Garment } from '../figure/garment.schema.ts'
import { RegistryClash } from './registry-clash.ts'

export interface OutfitHooks {
  /** The hair's tie when its entry names none (a wardrobe: the outfit's first metal swatch). */
  readonly tie?: (
    garments: readonly Garment[],
    swatches: Readonly<Record<string, Swatch>>,
  ) => string | undefined
  /**
   * The openings a hand can reach, from the anchors the kinds published (each with the garment that made it) and
   * every part dressed (the body's included), in place of the kinds' anchors as they stand.
   */
  readonly anchors?: (worn: readonly { anchor: Anchor; from: Garment }[], parts: readonly Part[]) => Anchor[]
}

let hooks: OutfitHooks = {}
let set = false

/** Sets the outfit hooks, once. A second set throws `RegistryClash`. */
export function registerOutfitHooks(next: OutfitHooks): void {
  if (set) throw new RegistryClash('outfit hooks', 'outfit hooks', 'The outfit hooks are already registered')
  hooks = next
  set = true
}

/** The hooks set so far; empty when none were. */
export const outfitHooks = (): OutfitHooks => hooks
