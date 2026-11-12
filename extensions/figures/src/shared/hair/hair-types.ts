import type { Measure } from '../body/genes'
import type { HeadForm } from '../body/head'
import type { Decal, Material, Mesh, Part } from '../body/parts'
import type { Skeleton } from '../body/rig'
import type { V3 } from '../math/math'
/**
 * The skull's frame: a rounded box round the lofted head (garments.ts head), its centre, radii, roundness and taper.
 * A style's head units (heights, angles round it, sizes of its half-width) are about it; what fits the head (a scalp, a
 * row's line, a fall's root) fits the head's own form (head.ts headForm; here onHead, toHead), so a style
 * hugs the round cranium, never a box round it.
 */
export interface Skull {
  c: V3
  r: V3
  e: [number, number]
  taper: [number, number]
}
/** A line round the skull: knots of [angle from the front, height], mirrored, eased between. */
export type Line = [number, number][]
/** A rope's make: its radius (of the skull's half-width), how flat it is (its depth over its width), how square, and
 * its texture: `beads` along it (a plait, `depth` deep), `ridges`
 * along it (strands), its ends. */
export interface Rope {
  r: number
  flat?: number
  e?: number
  /** `pitch`: in place of a count, each bead this long (of the unit), so ropes of one make bead alike whatever their
   * length. `plait`: the upper half of each bead in the lit tone, its edge a V dipping this much of a bead down the
   * rope's middle (the strands crossing in from either side), so a braid reads as a plait down its axis; false keeps
   * one tone (locs). */
  beads?: number
  pitch?: number
  depth?: number
  ridges?: [number, number]
  plait?: number | false
  /** Where along it its beads start (of a bead), and how far they slant across it (of a bead, edge to edge): a plait's
   * strands cross it on a diagonal, so the light on each bead is a slanted stroke, and ropes laid side by side with
   * their phases apart and their slants turned against each other read as a herringbone, never as rungs. */
  phase?: number
  slant?: number
  /** Streaks of the lit tone along it, across the side its depth faces (a quiff's sheen, a loc's lit edge): how many,
   * from and to (of its length, each streak's ends jittered), and how wide (of its share, either side; a third). */
  streaks?: [number, number, number, number?]
  tip?: 'point' | 'round' | 'blunt'
  root?: number
  taper?: number
  /** Faces round its section (10): a wide mass wants more, so its streaks and ridges are fine. */
  seg?: number
}

// ─── The pieces ───
/** A piece's colour: the hair, its lit tone (a plait's, a streak's, a coil's speck), the crest (a flat top in the light), the hair faded toward the skin (`fade1` most of the way to the hair, `fade2` mostly
 * skin), the scalp (the skin's own tone in shadow: the ground between cornrows), the parting (the hair's deep step: a
 * shadow between braids), a fade (the skin graded up to the stubble: Scalp.grade), or a swatch. */
export type Tone = 'hair' | 'lit' | 'crest' | 'fade1' | 'fade2' | 'scalp' | 'parting' | 'fade' | string
/** A shell; its `sheen`: `count` streaks round the comb in the lit tone (the first at `at` round it), between heights `from` and `to` (each streak's
 * ends jittered by `ragged`), each a spindle up to `width` of its share either side: the glossy band along the strands,
 * broken into strands' shines. */
export interface Scalp {
  from: Line
  to?: Line
  lift: number
  crown?: number
  edge?: number
  ridges?: [number, number]
  comb?: V3 | 'back'
  tone?: Tone
  sheen?: {
    count: number
    from: number
    to: number
    width?: number
    ragged?: number
    at?: number
  } /** A fade's grade up the band (0 its foot, 1 its top): from each height up, a tone (the skin below the first). */
  grade?: [number, Tone][] /** Only this far round either side of the front (a line-up at the temples). */
  span?: number
}
/** Rows from the hairline round `at` (the front by default), `span` either side of it, to one point (a direction from
 * the skull's centre, in head units) or each straight back to the nape. */
export interface Rows {
  count: number
  at?: number
  span: number
  from: Line
  to: V3 | 'nape'
  nape?: Line
  lift: number
  rope: Rope
  apart?: boolean
  matte?: boolean
  tone?: Tone
}
/** A ponytail tied at a direction from the skull's centre (head units); its ropes rise `rise` of the head's height and
 * fall `length` of it below the shoulders, spread across `spread` of the half-width at the tie and at the ends, clear of
 * the dressed trunk. */
export interface Tail {
  at: V3
  count: number
  rope: Rope
  rise: number
  length: number
  spread: [number, number]
  tie?: Tie
  cuffs?: string
  matte?: boolean
  /** 'down': a low pony, tied where `at` says (the nape) and falling straight down the back from the tie: no rise and no
   * arc over the crown, the ropes gathered in a ring across the fall and fanning below the shoulders, clear of the trunk. */
  hang?: 'down'
}
/**
 * A bun: one rope coiled in a flattened spiral on the skull, in the direction `at` from its centre (head units: [0, −0.35,
 * −1] the nape, [0, 0.95, −0.2] the crown), `r` of the skull's half-width across, `flat` (default 0.6) how flat it lies
 * along `at` (of its width), `turns` (default 2.5) round. Rigid on the head, clear of its form; its tie, if any, a band
 * round its root.
 */
export interface Bun {
  at: V3
  r: number
  flat?: number
  turns?: number
  rope: Rope
  tie?: Tie
}
/**
 * Loose hair: `count` clumps (ropes) laid on the scalp round the head from the hairline `from` and falling past it, either
 * side of the parting `part` (an angle from the front, 0 the centre), over the ears (outside the head's form), past the
 * collar and behind the shoulders, to `length` (0 the jaw … 1 the shoulder blades, the chest joint's height; clamped there),
 * clear of the dressed trunk. `curl` 0–1: 0 straight, rising to waves (each clump's path a sine), then spirals (a helix),
 * the clumps fatter and shorter as it rises; `volume` 0–1: how far the mass stands off the skull, so curl 1 and volume 1 at
 * a short length is a round afro. The clumps at the sides ride hair.L and hair.R, the rest hair.back, swinging as the tail does.
 */
export interface Fall {
  from: Line
  part?: number
  count: number
  /** 0 the chin, 1 the chest (a curl shortens it); to 2 the waist. Up to 1 it is as it always was. */
  length: number
  curl?: number
  volume?: number
  rope: Rope
  /** 0–1 (default 0): the share of the clumps rooted ahead of the ear that stay ahead: down the temple, in front of the ear
   * and the shoulder, and on over the chest, clear of the dressed trunk's front (as `trunkBack` clears its back) and never
   * across the face (outside the outer eye). At 0 every clump goes behind the ear, as it always did. */
  front?: number
  /** −1 to 1 (default 0): the ends' under-turn: over the last fifth of a clump, below the jaw, its path bends toward the
   * neck (positive) or flips out (negative) by at most two rope radii. */
  turn?: number
  /** The stand-off model (default `'head'`: a clump rides the head, a hair bone and, at most half, the neck, so long hair swings
   * out when the head pitches or cocks). `'trunk'`: a clump's points below the shoulder line ride the chest, those between the
   * jaw and the shoulder blend from the head's skinning to the chest's by height, and the hair bones' swing fades to nothing
   * by the shoulder: long hair lies on the shoulders and back and stays put, only the part by the head moving with it. */
  rest?: 'head' | 'trunk'
}
/**
 * A fringe: clumps from the crown forward over the forehead (`width` rad either side of the front, `count` of them, each a
 * rope), down to `length`: 0 the hairline, 1 the brow (the tip a texel above the eye line), 2 the chin, 3 the chest. Past
 * 1 it lies over the face, clear of it (the nose) and, past 2, of the dressed trunk's front. `sweep` (−1 to 1) combs it
 * toward one side. Rigid on the head to 2; past it hung from the head's skinning to the chest's by height (`Fall.rest: 'trunk'`).
 * To 1 it never reaches the eye row: a fringe does not hide the eyes unless the data asks for more.
 */
export interface Fringe {
  from: Line
  width: number
  length: number
  count: number
  rope: Rope
  sweep?: number
}
/** A tie: `true` the wearer's (HairInput.tie: the outfit's own metal, else a band of the hair's own), or a swatch. */
export type Tie = boolean | string
/** One of the three generators' pieces. */
export type OwnPiece =
  | { scalp: Scalp }
  | { rows: Rows }
  | { tail: Tail }
  | { bun: Bun }
  | { fall: Fall }
  | { fringe: Fringe }
/** A piece of a style: one of the three generators', or a registered piece (H3, registerHairPiece) keyed by its kind's
 * name, its value what that kind's builder takes. */
export type Piece = OwnPiece | { [kind: string]: unknown }
/** A style's finish, whatever colour it is worn in (a hair swatch gives only its hue ramp): tight coils (a fade's
 * stubble) or braids here, and any finish a fork registers (H4, registerFinish) by name. */
export type Finish = string
/** A finish's light (FINISH). */
export type HairFinish = { tones: [number, number, number]; matte: boolean }
/** `finish`: its texture's light; the colour it is worn in gives only the hue. */
export interface HairStyle {
  about: string
  pieces: Piece[]
  finish: Finish
}
export interface HairInput {
  m: Measure
  s: Skeleton
  hair: string
  skin: string
  swatch: (name: string) => Material
  /** The texels a metre it is drawn at (a tie, a cuff land on whole texels; the brand kit's twice when left out). */
  ppm?: number
  /** The wearer's tie (a swatch): the outfit's metal, or one it names. */
  tie?: string
  /** The dressed trunk (its tops and the body's torso, rest figure space): what a tail falls clear of. */
  trunk?: Part[]
  /** Under a cap or other headwear (outfit/garments.ts dress): the hair is drawn for it, as a registered piece (H3) may need to know. */
  capped?: boolean
}
export interface HairLook {
  parts: Part[]
  decals: Decal[]
  materials: Record<string, Material>
}
/**
 * What a registered hair piece (H3, registerHairPiece) is given: the style's input, its skull, head form, head pivot,
 * half-width and density, the parts and marks the style is making (a piece pushes onto them), the helpers the three
 * generators draw with (`rigid` a piece rigid on the head, `hung` one skinned to the hair's joints, `tone` a tone's
 * material in the style's finish, `tieOf` a tie's swatch), and `seam`, the one counter of own surfaces every piece of a
 * style shares, so seams number as they always have whatever the mix of pieces.
 */
export interface HairCtx {
  i: HairInput
  k: Skull
  form: HeadForm
  head: V3
  hw: number
  ppm: number
  parts: Part[]
  decals: Decal[]
  rigid(mesh: Mesh, t: Tone, own?: number, lit?: Mesh, matte?: boolean): void
  hung(
    mesh: Mesh,
    ts: number[],
    to: Tone,
    swing: (t: number) => [number, number][],
    own: number,
    lit?: Mesh,
    matte?: boolean,
  ): void
  tone(t: Tone, matte?: boolean): string
  tieOf(t: Tie | undefined): string | null
  /** The next own surface: the counter every piece of a style shares. */
  seam(): number
}
/** A hair piece a fork registers (H3): how one entry of a style's `pieces` is built. */
export interface HairPiece<T = unknown> {
  build(c: HairCtx, piece: T): void
  /** Its parts take the CROWN tag, like the scalp's and the rows': what is worn up on the head lies on them. */
  crown?: boolean
}
