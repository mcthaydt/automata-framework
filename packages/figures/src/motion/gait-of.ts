// A figure's gait (its library gait or inline one, with its own overrides) and its hair spring's numbers.
//
// From FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/cast.ts at a1f7246: `fromDef`'s
// `{ ...GAITS[def.gait], ...def.gaitOverrides }` and `{ ...HAIR, ...def.hair }`, and the default `HAIR`.

import type { FigureDef, HairDynamics } from '../figure/figure.schema'
import type { Gait } from '../library/gait.schema'

/** The hair's spring when a figure sets none (FigureBuilder's `HAIR`). */
export const DEFAULT_HAIR: HairDynamics = {
  stiff: 60,
  damp: 9,
  trail: 0.25,
  bounce: 0.06,
  sway: 1,
  hang: 0.5,
}

/** The figure's gait: the named library gait (or its inline one), then its `gaitOverrides`. */
export function gaitOf(def: FigureDef, gaits: Readonly<Record<string, Gait>>): Gait {
  const named = typeof def.gait === 'string' ? gaits[def.gait] : def.gait
  if (named === undefined) throw new Error(`no gait ${String(def.gait)}`)
  return { ...named, ...def.gaitOverrides }
}

/** The figure's hair spring: the default, then its own numbers. */
export function hairOf(def: FigureDef): HairDynamics {
  return { ...DEFAULT_HAIR, ...def.hair }
}
