// The outfit hooks (H2): what an extension tunes in `dress` without editing it. Both are callbacks core never
// sets. They are set once, by the one extension that owns the look of an outfit (a wardrobe); a second set fails.

import { RegistryClash } from '../../../shared/registry/registry-clash.ts'
import type { Measure } from '../body/genes.ts'
import type { Part } from '../body/mesh.ts'
import type { Skeleton } from '../body/rig.ts'
import type { Swatch } from '../content/swatch.schema.ts'
import type { Anchor } from '../figure/anchors.ts'
import type { Garment } from '../figure/garment.schema.ts'

/** The outfit being dressed: the body's measure and skeleton, and every garment in order. */
export interface OutfitBody {
  readonly m: Measure
  readonly s: Skeleton
  readonly garments: readonly Garment[]
}

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
  readonly anchors?: (
    worn: readonly { anchor: Anchor; from: Garment }[],
    parts: readonly Part[],
    outfit: OutfitBody,
  ) => Anchor[]
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
