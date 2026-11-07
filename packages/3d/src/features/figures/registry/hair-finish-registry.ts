// H4, the hair finishes: how a style's hair is painted. In AF's 3D look a finish only says whether it is matte (no
// glint, and its lit tone a step up too, so a plait's beads or a loc's edge read on the dark side as well); the
// painter's thresholds stay in FigureBuilder (M3 spec section 4.4.1). Core has the two glossy finishes; the matte ones
// (coil, braid, loc, curl) and the gleaming `smooth` come with the character kit, which registers them, and a style
// names one by its `finish`.
//
// Ported from FigureBuilder (mcthaydt/FigureBuilder) src/features/hair/hair.ts at 025ffb4 (`registerFinish`, `FINISH`'s
// matteness).

import { RegistryClash } from '../../../shared/registry/registry-clash.ts'

/** A finish's light, as far as the 3D look keeps it. */
export interface HairFinish {
  readonly matte: boolean
}

/** The finishes core has, as the source's FINISH table has their matteness. */
const BASE: Readonly<Record<string, HairFinish>> = {
  sleek: { matte: false },
  straight: { matte: false },
}

const FINISHES = new Map<string, HairFinish>(Object.entries(BASE))

/** Registers a hair finish under `name`. Throws on a name the base or an earlier registration has taken. */
export function registerFinish(name: string, finish: HairFinish): void {
  if (FINISHES.has(name)) throw new RegistryClash('hair finish', name)
  FINISHES.set(name, { ...finish })
}

/** The finish names there are, base first. */
export const finishNames = (): string[] => [...FINISHES.keys()]

/** Whether a finish is matte; an unknown name is not (the schema has refused it by then). */
export const finishMatte = (name: string): boolean => FINISHES.get(name)?.matte ?? false
