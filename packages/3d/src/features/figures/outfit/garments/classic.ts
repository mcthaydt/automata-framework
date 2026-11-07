// The core garments: each fitted to the body the sliders make. A top repaints the torso and as much of the arms as its
// sleeves cover; trousers and shoes repaint the legs and feet; a cape adds its own parts. (Hair, caps and the face are
// dress.ts's. The rest of a wardrobe, apron, belt, coat, gloves, legs, mark, skirt and waistcoat, is
// @automata/character-kit's, and an extension's wardrobe builds its own kinds.)

import { axisAngle, smooth } from '../../../../shared/math/math.ts'
import { tube } from '../../../../shared/math/superquadric.ts'
import type { Measure } from '../../body/genes.ts'
import { type Decal, GROUP, type Part } from '../../body/mesh.ts'
import type { Body } from '../../body/profiles.ts'
import { J, type Side, type Skeleton } from '../../body/rig.ts'
import { weights } from '../../body/skin-weights.ts'
import type { HairStyle } from '../../content/hair.schema.ts'
import type { Headwear } from '../../content/headwear.schema.ts'
import type { Swatch } from '../../content/swatch.schema.ts'
import type { Classic, Garment } from '../../figure/garment.schema.ts'
import { GARMENT_DEFAULTS } from '../../figure/garment-defaults.ts'
import type { Made } from '../../figure/materials.ts'
import { armGroup, type Regions } from './body.ts'
import { SIDES } from './head.ts'
import { box } from './locks.ts'

const FRONT = Math.PI / 2

/** The libraries a body is dressed from: its swatches, hair styles and headwear, by id. */
export interface Wardrobe {
  readonly swatches: Readonly<Record<string, Swatch>>
  readonly hair: Readonly<Record<string, HairStyle>>
  readonly headwear: Readonly<Record<string, Headwear>>
}

/** What the garments build up as an outfit is dressed: the regions they repaint, their parts and marks, and
 * how the body under them stands (thighs shown, the chest's front, boots, the outermost hanging garment). */
export interface Dressing {
  readonly m: Measure
  readonly s: Skeleton
  /** The body under the clothes as a query: a cuff and a collar are sized from it. */
  readonly body: Body
  readonly garments: readonly Garment[]
  /** What the hair, caps and the face are drawn from: the libraries, the figure's materials and its own hair pieces. */
  readonly wardrobe: Wardrobe
  readonly made: Made
  readonly hairPieces: readonly string[] | undefined
  readonly r: Regions
  readonly parts: Part[]
  readonly decals: Decal[]
  thighs: boolean
  /** How far the chest's front stands out (a coat, a bib move it: an extension's garments set it). */
  front: number
  boots: boolean
  /** The outermost hanging garment so far (a coat), which an apron must clear: the character kit's garments set and read it. */
  outer: { waist: number; hem: number }
}

/** Where a hanging garment of `length` ends: 0 the hip, 0.5 the knee, 1 the ankle. */
export const hemAt = (s: Skeleton, length: number): number => {
  const knee = s.hipY - s.thigh
  return length <= 0.5
    ? s.hipY - (s.thigh * length) / 0.5
    : knee - ((knee - s.genes.ankle * 2) * (length - 0.5)) / 0.5
}
/**
 * A top's cuff on a side: a box round the forearm (`long` sleeves, at 0.9 of its length) or the upper arm (short, at
 * 0.86). It hugs the arm: each radius is the arm's widest over the cuff's span plus the clearance (a texel), centred on
 * the arm's own profile there, so it clears any arm and follows fat, and a thin arm gets a slim cuff, not a flare.
 */
function cuff(side: Side, material: string, long: boolean, d: Dressing): Part {
  const { s, body } = d
  const k = d.m.k
  const bone = long ? J[`foreArm.${side}`] : J[`upperArm.${side}`]
  const rest = s.rest[bone] ?? [0, 0, 0]
  const y = rest[1] - (long ? 0.9 * s.foreArm : 0.86 * s.upperArm)
  const hh = (long ? 0.022 : 0.02) * k
  const g = body.girth('arm', side, y + hh, y - hh)
  return box(bone, material, armGroup(side), {
    at: [(g.dx ?? 0) - rest[0], y - rest[1], (g.dz ?? 0) - rest[2]],
    r: [g.rx + body.clear, hh, g.rz + body.clear],
    e: [0.45, 0.6],
  })
}

/**
 * One side of a top's collar. It sits at 0.172 k above the chest bone, on the neck (past the trunk's top cap), so it is
 * sized from the neck's profile there, in the chest bone's space: the old centres are the floor, and the pieces stand
 * out only as far as their outer faces clear the neck's side and front by the clearance (a thick neck pushes it out).
 */
function collarPiece(x: 1 | -1, material: string, d: Dressing): Part {
  const { s, body } = d
  const k = d.m.k
  const yc = 0.172 * k
  const chest = s.rest[J.chest] ?? [0, 0, 0]
  const neck = s.rest[J.neck] ?? [0, 0, 0]
  const n = body.at('neck', 'L', chest[1] + yc - neck[1])
  const nz = neck[2] - chest[2] + (n.dz ?? 0)
  const cx = Math.max(0.04 * k, n.rx + body.clear - 0.04 * k)
  const cz = Math.max(0.045 * k, nz + n.rz + body.clear - 0.04 * k)
  return box(J.chest, material, GROUP.torso, {
    at: [x * cx, yc, cz],
    r: [0.04 * k, 0.018 * k, 0.04 * k],
    turn: axisAngle([0, 1, 0], x * 0.5),
    e: [0.35, 0.5],
  })
}

/**
 * Wears one classic garment: repaints regions and adds parts. Returns false for a garment that is not one of
 * these.
 */
export function wearClassic(d: Dressing, item: Classic): boolean {
  const { m, s, r, parts } = d
  const k = m.k
  if ('top' in item) {
    r.chest = r.waist = r.shoulder = item.top
    if (item.sleeves !== 'none') r.upper = item.top
    if (item.sleeves === 'long') r.fore = item.top
    const cuffs = item.cuffs
    if (cuffs) for (const [side] of SIDES) parts.push(cuff(side, cuffs, item.sleeves === 'long', d))
    const collar = item.collar
    if (collar) for (const [, x] of SIDES) parts.push(collarPiece(x, collar, d))
  } else if ('trousers' in item) {
    r.pelvis = r.thigh = r.knee = r.shin = item.trousers
  } else if ('shoes' in item) {
    r.shoe = item.shoes
    r.sole = item.sole ?? GARMENT_DEFAULTS.shoes.sole
    d.boots = !!item.boots
  } else if ('cape' in item) {
    const top = s.shoulderY + 0.03 * k
    const bottom = hemAt(s, item.length ?? 0.05)
    const mesh = tube([top, 0.2 * k, 0.15 * k, -0.01], [bottom, 0.3 * k, 0.24 * k, -0.02], {
      seg: 18,
      rings: 5,
      belly: 0.03,
      arc: [FRONT + 0.45, FRONT + 2 * Math.PI - 0.45],
    })
    parts.push({
      mesh,
      material: item.cape,
      group: GROUP.cape,
      skin: weights(mesh, (_x, y) => {
        const down = smooth((top - y) / (top - bottom))
        return [
          [J.chest, 1 - down * 0.6],
          [J.pelvis, down * 0.6],
        ]
      }),
    })
    const trim = item.trim
    if (trim)
      parts.push(
        ...SIDES.map(([, x]) =>
          box(J.chest, trim, GROUP.cape, {
            at: [x * 0.085 * k, 0.12 * k, 0.11 * k],
            r: [0.018 * k, 0.05 * k, 0.014 * k],
            e: [0.3, 0.4],
          }),
        ),
      )
  } else return false
  return true
}
