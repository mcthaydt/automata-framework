// The classic garments: each fitted to the body the sliders make. A top repaints the torso and as much of the
// arms as its sleeves cover; a skirt hangs from the waist to the length asked for; an apron, a coat, a cape,
// a belt and marks add their own parts. (Hair, caps and the face are dress.ts's; streetwear is streetwear/.)
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`hemAt`,
// `hang`, `band` and `dress`'s branches for top, waistcoat, trousers, legs, shoes, gloves, skirt, coat,
// apron, belt, cape and mark), with AF's strict types; the formulas and their order are the source's. Cut:
// the skirt's stain (a painter wash).

import { axisAngle, smooth } from '../../../../shared/math/math.ts'
import type { Measure } from '../../body/genes.ts'
import { type Decal, GROUP, type Part } from '../../body/mesh.ts'
import { at, J, type Skeleton } from '../../body/rig.ts'
import { hemWeights, weights } from '../../body/skin-weights.ts'
import { tube } from '../../body/superquadric.ts'
import type { Classic, Garment, Skirt } from '../../figure/garment.schema.ts'
import { GARMENT_DEFAULTS } from '../../figure/garment-defaults.ts'
import { armGroup, type Regions, TRAPEZIUS, trapezius } from './body.ts'
import { SIDES } from './head.ts'
import { box } from './locks.ts'

const FRONT = Math.PI / 2

/** What the garments build up as an outfit is dressed: the regions they repaint, their parts and marks, and
 * how the body under them stands (thighs shown, the chest's front, boots, the outermost hanging garment). */
export interface Dressing {
  readonly m: Measure
  readonly s: Skeleton
  readonly garments: readonly Garment[]
  readonly r: Regions
  readonly parts: Part[]
  readonly decals: Decal[]
  thighs: boolean
  /** How far the chest's front stands out (a coat, a bib move it). */
  front: number
  boots: boolean
  /** The outermost hanging garment so far (a coat), which an apron must clear. */
  outer: { waist: number; hem: number }
}

/** Where a skirt or coat of `length` ends: 0 the hip, 0.5 the knee, 1 the ankle. */
const hemAt = (s: Skeleton, length: number) => {
  const knee = s.hipY - s.thigh
  return length <= 0.5
    ? s.hipY - (s.thigh * length) / 0.5
    : knee - ((knee - s.genes.ankle * 2) * (length - 0.5)) / 0.5
}
/**
 * A tube from `top` to `bottom` (heights above the floor), riding the pelvis and following the thighs below.
 */
function hang(
  material: string,
  group: number,
  top: number,
  bottom: number,
  o: {
    waist: number
    hem: number
    depth?: number
    belly?: number
    follow?: number
    arc?: [number, number]
    folds?: [number, number]
    seg?: number
  },
): Part {
  const mesh = tube(
    [top, o.waist, o.waist * (o.depth ?? 0.8), 0],
    [bottom, o.hem, o.hem * (o.depth ?? 0.8), 0.01],
    {
      belly: o.belly ?? 0.04,
      seg: o.seg ?? 24,
      rings: 5,
      arc: o.arc,
      folds: o.folds,
    },
  )
  return {
    mesh,
    material,
    group,
    skin: hemWeights(mesh, J.pelvis, J['thigh.L'], J['thigh.R'], top - 0.05, bottom, o.follow ?? 0.75, o.hem),
  }
}
const band = (material: string, group: number, y: number, height: number, rx: number, rz: number): Part => {
  const mesh = tube([y + height / 2, rx, rz, 0], [y - height / 2, rx, rz, 0], { seg: 18, rings: 1 })
  return { mesh, material, group, skin: weights(mesh, () => [[J.pelvis, 1]]) }
}

/**
 * Wears one classic garment: repaints regions and adds parts. Returns false for a garment that is not one of
 * these.
 */
export function wearClassic(d: Dressing, item: Classic): boolean {
  const { m, s, r, parts, decals } = d
  const g = s.genes
  const k = m.k
  const t = m.thick
  const waistY = s.hipY + 0.14 * k
  const chestFront = 0.1 * k * t * m.depth
  if ('top' in item) {
    r.chest = r.waist = r.shoulder = item.top
    if (item.sleeves !== 'none') r.upper = item.top
    if (item.sleeves === 'long') r.fore = item.top
    const cuffs = item.cuffs
    if (cuffs)
      for (const [side] of SIDES)
        parts.push(
          item.sleeves === 'long'
            ? box(J[`foreArm.${side}`], cuffs, armGroup(side), {
                at: [0, -s.foreArm * 0.9, 0],
                r: [0.048 * k * t * m.arm, 0.022 * k, 0.05 * k * t * m.arm],
                e: [0.45, 0.6],
              })
            : box(J[`upperArm.${side}`], cuffs, armGroup(side), {
                at: [0, -s.upperArm * 0.86, 0],
                r: [0.056 * k * t * m.arm, 0.02 * k, 0.058 * k * t * m.arm],
                e: [0.45, 0.6],
              }),
        )
    const collar = item.collar
    if (collar)
      for (const [, x] of SIDES)
        parts.push(
          box(J.chest, collar, GROUP.torso, {
            at: [x * 0.04 * k, 0.172 * k, 0.045 * k],
            r: [0.04 * k, 0.018 * k, 0.04 * k],
            turn: axisAngle([0, 1, 0], x * 0.5),
            e: [0.35, 0.5],
          }),
        )
  } else if ('waistcoat' in item) {
    r.waist = item.waistcoat
    parts.push(
      box(J.chest, item.waistcoat, GROUP.torso, {
        at: [0, 0.035 * k, 0],
        r: [g.shoulders * 0.96 * m.chest, 0.13 * k, chestFront * 1.18],
        taper: [0.94, 0.92],
        e: [0.72, 0.6],
        keep: (x, y, z) => y < 0.62 && !(z > 0.45 && y > 0.05 && Math.abs(x) < 0.3),
      }),
    )
  } else if ('trousers' in item) {
    r.pelvis = r.thigh = r.knee = r.shin = item.trousers
  } else if ('legs' in item) {
    r.thigh = r.knee = r.shin = item.legs
  } else if ('shoes' in item) {
    r.shoe = item.shoes
    r.sole = item.sole ?? GARMENT_DEFAULTS.shoes.sole
    d.boots = !!item.boots
  } else if ('gloves' in item) {
    r.hand = item.gloves
  } else if ('skirt' in item) {
    const bottom = hemAt(s, item.length)
    if (item.length > 0.3) d.thighs = false
    // Under a skirt the hips are the skirt's: nothing of the body shows through where it pokes out.
    r.pelvis = item.skirt
    const flare = (0.16 + 0.1 * (item.flare ?? 0.4)) * k
    parts.push(
      hang(item.skirt, GROUP.skirt, waistY, bottom, {
        waist: 0.138 * k * m.waist,
        hem: flare,
        follow: 0.75,
        folds: [7, item.folds ?? 0.06],
      }),
    )
    if (item.hem)
      parts.push(
        hang(item.hem, GROUP.skirt, bottom + 0.035 * k, bottom - 0.02 * k, {
          waist: flare * 0.985,
          hem: flare * 1.02,
          follow: 0.75,
          belly: 0,
          folds: [7, item.folds ?? 0.06],
        }),
      )
  } else if ('coat' in item) {
    r.chest = r.waist = r.shoulder = r.upper = r.fore = r.pelvis = item.coat
    const bottom = hemAt(s, item.length)
    if (item.length > 0.45) d.thighs = false
    parts.push(
      hang(item.coat, GROUP.skirt, waistY, bottom, {
        waist: 0.15 * k * m.waist,
        hem: 0.21 * k,
        follow: 0.7,
        folds: [5, 0.04],
      }),
    )
    d.outer = { waist: 0.15 * k * m.waist, hem: 0.21 * k }
    d.front = chestFront * 1.04
    const collar = item.collar
    if (collar)
      parts.push(
        ...SIDES.map(([, x]) =>
          box(J.chest, collar, GROUP.torso, {
            at: [x * 0.055 * k, 0.12 * k, chestFront * 0.9],
            r: [0.03 * k, 0.07 * k, 0.014 * k],
            turn: axisAngle([0, 0, 1], -x * 0.35),
            e: [0.35, 0.45],
          }),
        ),
      )
    if (item.buttons)
      for (let i = 0; i < 3; i++)
        decals.push({
          bone: J.chest,
          at: [0, (0.06 - i * 0.07) * k, chestFront + 0.008],
          normal: [0, 0, 1],
          material: item.buttons,
        })
  } else if ('apron' in item) apron(d, item, chestFront, waistY)
  else if ('belt' in item) {
    parts.push(
      band(item.belt, GROUP.torso, waistY - 0.005, 0.045 * k, 0.142 * k * m.waist, 0.142 * k * m.waist * 0.8),
    )
    if (item.buckle)
      parts.push(
        box(J.pelvis, item.buckle, GROUP.torso, {
          at: [0, waistY - at(s.rest, J.pelvis)[1] - 0.005, 0.118 * k * m.waist],
          r: [0.036 * k, 0.024 * k, 0.012 * k],
          e: [0.3, 0.4],
        }),
      )
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
  } else if ('colour' in item) {
    const x = item.side === 'L' ? 1 : -1
    decals.push(
      item.mark === 'watch'
        ? {
            bone: J.chest,
            at: [x * 0.055 * k, 0.09 * k, d.front],
            normal: [0, 0, 1],
            material: item.colour,
            size: [1, 2],
          }
        : {
            bone: J.chest,
            at: [x * 0.06 * k, 0.1 * k, d.front],
            normal: [0, 0, 1],
            material: item.colour,
            size: [2, 1],
          },
    )
  } else return false
  return true
}

/** An apron: its skirt just outside the dress's (and any coat's), a bib, straps over the shoulders or round
 * the neck, a tie at the back, pockets in its own cloth. */
function apron(
  d: Dressing,
  item: Extract<Classic, { apron: string }>,
  chestFront: number,
  waistY: number,
): void {
  const { m, s, parts } = d
  const g = s.genes
  const k = m.k
  const t = m.thick
  const bottom = hemAt(s, item.length)
  // The apron's skirt sits just outside the dress's: cinched at the waist, flaring as the dress does.
  const dress = d.garments.find((x): x is Skirt => 'skirt' in x)
  const flare = (0.16 + 0.1 * (dress?.flare ?? 0.4)) * k
  const wrap = item.wrap ?? (item.straps === 'neck' ? 1.45 : 1.1)
  parts.push(
    hang(item.apron, GROUP.skirt, waistY - 0.01, bottom, {
      waist: Math.max(0.15 * k * m.waist, d.outer.waist * 1.06),
      hem: Math.max(flare * 0.95, d.outer.hem * 1.04),
      depth: (item.wrap ?? 0) > 1.6 ? 1 : 0.84,
      follow: 0.75,
      arc: [FRONT - wrap, FRONT + wrap],
      seg: 12,
    }),
  )
  if (item.bib !== false) {
    parts.push(
      box(J.chest, item.apron, GROUP.torso, {
        at: [0, 0.035 * k, d.front * 0.93],
        r: [g.shoulders * (item.bibWidth ?? (item.straps === 'neck' ? 0.7 : 0.56)), 0.115 * k, 0.022 * k],
        e: [0.35, 0.45],
        taper: [0.92, 1],
      }),
    )
    d.front = d.front * 0.93 + 0.024 * k
  }
  if (item.straps === 'cross') {
    // Over each shoulder, lying on the trapezius's slope, front to back.
    parts.push(
      ...SIDES.map(([, x]) =>
        box(J.chest, item.apron, GROUP.torso, {
          at: trapezius(s, x, g.shoulders * 0.04, 0.03 * k),
          r: [0.026 * k, 0.014 * k, chestFront * 1.08],
          turn: axisAngle([0, 0, 1], -x * TRAPEZIUS),
          e: [0.35, 0.45],
        }),
      ),
    )
    parts.push(
      ...SIDES.map(([, x]) =>
        box(J.chest, item.apron, GROUP.torso, {
          at: [0, -0.02 * k, -chestFront * 0.98],
          r: [0.022 * k, 0.16 * k, 0.012 * k],
          turn: axisAngle([0, 0, 1], x * 0.45),
          e: [0.35, 0.45],
        }),
      ),
    )
  }
  // The tie: a knot at the small of the back and its two ends hanging from it.
  if (item.tie) {
    const back = -Math.max(0.105 * k * t * m.depth, d.outer.waist) - 0.012 * k
    const knotY = waistY - s.hipY - 0.05 * k - 0.01
    parts.push(
      box(J.pelvis, item.apron, GROUP.torso, {
        at: [0, knotY, back],
        r: [0.028 * k, 0.02 * k, 0.014 * k],
        e: [0.5, 0.5],
      }),
    )
    parts.push(
      ...SIDES.map(([, x]) =>
        box(J.pelvis, item.apron, GROUP.torso, {
          at: [x * 0.018 * k, knotY - 0.07 * k, back + 0.004 * k],
          r: [0.012 * k, 0.065 * k, 0.008 * k],
          turn: axisAngle([0, 0, 1], x * 0.12),
          e: [0.35, 0.45],
        }),
      ),
    )
  }
  if (item.straps === 'neck')
    parts.push(
      box(J.neck, item.apron, GROUP.torso, {
        at: [0, 0, 0],
        r: [0.05 * k, 0.012 * k, 0.05 * k],
        e: [0.3, 0.3],
      }),
    )
  // Pockets in the apron's own cloth.
  if (item.pockets)
    parts.push(
      ...SIDES.map(([, x]) =>
        box(J.pelvis, item.apron, GROUP.torso, {
          at: [x * 0.075 * k, -0.11 * k, 0.17 * k],
          r: [0.05 * k, 0.045 * k, 0.012 * k],
          e: [0.3, 0.4],
        }),
      ),
    )
}
