// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 25 of the builders-fold plan (the strict flags) replaces each with a check

import { GROUP, type Material, type Part, type Superquadric, superquadric } from '../body/parts'
import type { Side } from '../body/rig'
import type { GarmentKind, OutfitHooks } from './garments-types'
import swatchLibrary from './library/swatches.json'
/**
 * The body and what the base pair wears. A character is sliders (genes.ts) plus a list of garments, each fitted to the
 * body the sliders make: a top painted on the torso and as much of the arms as its sleeves cover, shorts painted on the
 * hips and thighs, a hair style from the generator's pieces (hair.ts), and the eyes, whose lids, brows and mouth are
 * marks (decals that an expression changes) unless the painter draws the face (paint.ts). The body is profiled limbs
 * (parts.ts), each one surface, with a head (head form, ears, nose), hands and bare feet. Colours are named DUEL
 * swatches (library/swatches.json). A fork adds its wardrobe beside this, in its own feature folder.
 */
/** The group (parts.ts GROUP) of a side's arm and of its leg: the parts a garment adds to a limb carry it, so the limb's
 * surface rules (the body's seams, the painter's layers) treat them as that limb's. */
export const armGroup = (side: Side) => (side === 'L' ? GROUP.armL : GROUP.armR),
  legGroup = (side: Side) => (side === 'L' ? GROUP.legL : GROUP.legR)
/** Both sides with the sign of their x: the left is +x, the right −x. */
export const sides = [
  ['L', 1],
  ['R', -1],
] as const
/** A rounded box: the kit's one primitive. */
export const box = (
  bone: number,
  material: string,
  group: number,
  o: Superquadric,
  extra: Partial<Part> = {},
): Part => ({
  bone,
  material,
  group,
  mesh: superquadric({ e: [0.5, 0.55], seg: 10, rings: 6, ...o }),
  ...extra,
})

// ─── Swatches: named DUEL ramp rows and steps (src/shared/paint/duel-ramps.ts), from the library (library/swatches.json) ───
/** The shared palette library; a character file adds its own swatches (cast.ts). Every colour is DUEL-checked (tests). */
export const SWATCHES = swatchLibrary as unknown as Record<string, Material>
/** A library entry by name, or the entry itself where one is given in place of a name; throws on a name the library lacks. */
export const named = <T>(library: Record<string, T>, kind: string, style: string | T): T => {
  if (typeof style !== 'string') return style
  const found = library[style]
  if (!found) throw new Error(`no ${kind} ${style}`)
  return found
}
/** The garment kinds a fork registers (registerGarment), by name, in registration order. Empty in base. */
const KINDS = new Map<string, GarmentKind>()
/** The keys the base pair's garments carry (BaseGarment): a kind named after one would take those items from dress()'s
 * own branches, so none may be registered. A fork adds garments; it does not override the base ones. */
const BASE_KEYS = [
  'top',
  'sleeves',
  'cuffs',
  'collar',
  'shorts',
  'hair',
  'style',
  'tie',
  'eyes',
  'stubble',
  'lids',
  'brows',
  'white',
  'lips',
]
/** Registers a garment kind under `kind`, the key its items carry ({ tee: 'iceTee', … }). Throws on a name taken, the
 * base garments' keys included. A kind's name should not be a field of another kind's items: the first registered match
 * wins. */
export function registerGarment(kind: string, entry: GarmentKind): void {
  if (BASE_KEYS.includes(kind) || KINDS.has(kind))
    throw new Error(`garment kind ${kind} is registered already`)
  KINDS.set(kind, entry)
}
/** The registered kind an item is, if any: the first, in registration order, whose name is one of its keys. */
export const kindOf = (item: object): GarmentKind | undefined => {
  for (const [k, e] of KINDS) if (k in item) return e
  return undefined
}
/** The outfit hooks a fork installs (registerOutfitHooks). None in base. */
export let hooks: OutfitHooks = {}
let hooked = false
/** Installs the outfit hooks (H2), once: a second registration throws. */
export function registerOutfitHooks(h: OutfitHooks): void {
  if (hooked) throw new Error('outfit hooks are registered already')
  hooks = h
  hooked = true
}
