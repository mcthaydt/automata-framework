// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 25 of the builders-fold plan (the strict flags) replaces each with a check

import type { HeadShape, Measure } from '../body/genes'
import type { Decal, Material, Part } from '../body/parts'
import type { Skeleton } from '../body/rig'
import type { HairStyle } from '../hair/hair'
import type { Anchor } from '../motion/motion'
import type { Body, Profiles } from './fit'
import type { ShoeForm } from './shoe'
// ─── Garments ───
/** The garments the base pair wears (the union a fork widens through GarmentKinds, below). */
export type BaseGarment =
  /** A top painted on the torso, and as much of the arms as its sleeves cover (the base pair's: none). */
  | { top: string; sleeves?: 'none' | 'short' | 'long'; cuffs?: string; collar?: string }
  /** Shorts painted on the body (the hips and thighs), with no cloth of their own: a base figure's modest block. */
  | { shorts: string }
  /** `tie`: the band a pony or a bun is tied with (a swatch); left out, a band of the hair's own. */
  | { hair: string; style: string | HairStyle; tie?: string }
  /** The eyes, the marks face's lids and brows, and the drawn face's (paint.ts) whites and lips. */
  | { eyes: string; stubble?: string; lids?: string; brows?: string; white?: string; lips?: string }
/** Materials of the body's regions; garments repaint them. */
export interface Regions {
  skin: string
  chest: string
  waist: string
  pelvis: string
  shoulder: string
  upper: string
  fore: string
  hand: string
  thigh: string
  knee: string
  shin: string
  shoe: string
  sole: string
  neck: string
}
/** A dressed body: its parts and marks, any materials the outfit makes for itself, its face, and the openings a hand can
 * reach (motion.ts Anchor). Base's garments publish none, so a hand finds the body's own hip (motion.ts openings); a
 * fork's wardrobe publishes its pockets and hems here. */
export interface Look {
  parts: Part[]
  decals: Decal[]
  materials?: Record<string, Material>
  face?: FaceLook
  anchors?: Anchor[]
  /** The body's profiles (fit.ts), which dress() always fills: the cloth coordinates (figure/cloth.ts) are mapped round them. Optional, since a fork may build a Look by hand. */
  profiles?: Profiles
}
/** What the painter's drawn face takes from the outfit (paint.ts): the head's structure, and its colours as swatch names. */
export interface FaceLook {
  shape: HeadShape
  eyes?: string
  white?: string
  brows?: string
  lips?: string
}

// ─── Hooks: how a fork adds garments and tunes the outfit, with nothing registered in base ───
/**
 * What a registered garment kind's builder is given (H1, `registerGarment`): the body, the whole outfit, the swatches,
 * the density, the parts worn so far (not the body's own: `worn` is the very array dress() fills, so a kind built last
 * sees every part worn by then), and a scratch record the outfit's kinds share for the length of one dress() (an apron
 * reads there what a coat published, so it clears it).
 */
export interface Wearing {
  m: Measure
  s: Skeleton
  garments: Garment[]
  swatch: (name: string) => Material
  swatches: Record<string, Material>
  ppm?: number
  worn: Part[]
  state: Record<string, unknown>
  /** The wearer's skin swatch (the name `dress()` is given), so a kind mixes from the skin it covers: `rampOf(c.swatch(c.skin))`. */
  skin: string
  /** The body's real measures (fit.ts): its ring at a height, its girth over a span and the clearance to leave, so a sleeve
   * end or a hem sizes from the body (fat, bust, seat, limb girth) and clears any body the sliders make. */
  body: Body
}
/** What a garment kind makes (H1), applied by dress() in this order: its parts, its marks, its materials, the body
 * regions it repaints (`paint`), and the openings a hand can reach (`anchors`, motion.ts Anchor). */
export interface Fit {
  parts: Part[]
  decals?: Decal[]
  materials?: Record<string, Material>
  paint?: Partial<Regions>
  anchors?: Anchor[]
  /** false: the body draws no thighs under it (a long skirt or coat). And-ed across the outfit. */
  thighs?: boolean
  /** The shod foot's form (shoe.ts `ShoeForm`: a shaft, a low heel, a thicker sole, a toe cap), built by `body()` and `dress()`
   * where the `shoe` region is repainted; the last garment in the outfit that sets one wins. None: today's shoe. */
  shoe?: ShoeForm
}
/** A garment kind a fork registers (H1): how its items are built, and when in the outfit they are worn. */
export interface GarmentKind<T = unknown> {
  /** The item's fit, built in garment order with the outfit's other kinds. */
  build(c: Wearing, item: T): Fit
  /** Built after the rest of the outfit, on what is worn by then (a belt over the coat, shades pushed up). */
  last?: boolean
  /** Built after the `last` kinds, in garment order (boots' shafts, over the shins the rest has drawn). */
  after?(c: Wearing, item: T): Fit
  /** Headwear: the hair is drawn under it (HairInput `capped`). `press`, if it returns one, fits the hair's parts inside
   * the headwear's dome. */
  coversHair?(c: Wearing, item: T): { press?: (hair: Part[]) => Part[] }
}
/**
 * The garment kinds a fork adds to the union of Garment, by augmentation: a fork declares
 * `declare module '…/outfit/garments' { interface GarmentKinds { tee: Tee } }` for each kind it registers
 * (`registerGarment`), and its items then typecheck as garments. Empty in base.
 */
// biome-ignore lint/suspicious/noEmptyInterface: hosts merge their kinds into it by module augmentation, which a type alias cannot take
export interface GarmentKinds {}
/** Any garment: the base pair's, or one of the kinds a fork registers (GarmentKinds). */
export type Garment = BaseGarment | GarmentKinds[keyof GarmentKinds]
/**
 * What a fork tunes in dress() without editing it (H2, `registerOutfitHooks`). Both are callbacks base never sets.
 */
export interface OutfitHooks {
  /** The hair's tie when its entry names none (the wardrobe: the outfit's first metal swatch). */
  tie?(garments: Garment[], swatches: Record<string, Material>): string | undefined
  /** The openings a hand can reach, from the anchors the kinds published (each with the garment that made it) and every
   * part dressed (the body's included), in place of the kinds' anchors as they stand (the wardrobe: those a hand can
   * reach, and a pendant's where no chain publishes one). */
  anchors?(c: Wearing, worn: { anchor: Anchor; from: Garment }[], parts: Part[]): Anchor[]
}
