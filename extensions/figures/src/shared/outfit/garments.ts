// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 25 of the builders-fold plan (the strict flags) replaces each with a check
import type { Measure } from '../body/genes'
import { type Decal, GROUP, type Material, type Part } from '../body/parts'
import { J, type Skeleton } from '../body/rig'
import { HAIR_STYLES, hairParts } from '../hair/hair'
import type { V3 } from '../math/math'
import type { Anchor } from '../motion/motion'
import { FACE_SEAM } from '../paint/paint'
import { bodyOf } from './fit'
import { body, collarPiece, cuff, earSkins, SURFACE } from './garments-parts'
import { box, hooks, kindOf, legGroup, named, SWATCHES, sides } from './garments-registry'
import type { FaceLook, Fit, Garment, Look, Regions, Wearing } from './garments-types'
import { type ShoeForm, shoeExtras } from './shoe'

export { NECK } from './garments-parts'
export { box, registerGarment, registerOutfitHooks, SWATCHES } from './garments-registry'
export type {
  BaseGarment,
  FaceLook,
  Fit,
  Garment,
  GarmentKind,
  GarmentKinds,
  Look,
  OutfitHooks,
  Regions,
  Wearing,
} from './garments-types'

/**
 * Dresses a body: the garments in order repaint regions and add parts, then the body is built under them. Returns
 * the parts and decals, every one sized from the measure; `ppm` the texels a metre it is drawn at (the cell's), so the
 * small features (a hair tie, an ear's rim) land on whole texels at any density. A fork's registered kinds (H1) are worn
 * at their place in the garment order, those built `last` and then their `after` once the rest is on; the outfit hooks
 * (H2) set the hair's tie where the entry names none and pick the anchors. With none registered, none of that runs.
 */
export function dress(
  m: Measure,
  s: Skeleton,
  skin: string,
  garments: Garment[],
  swatches: Record<string, Material> = SWATCHES,
  ppm?: number,
): Look {
  const swatch = (name: string): Material => {
    const found = swatches[name]
    if (!found) throw new Error(`no swatch ${name}`)
    return found
  }
  const g = s.genes,
    hw = (g.head * g.headWidth) / 2,
    hd = (g.head * g.headDepth) / 2,
    h = g.head
  const r: Regions = {
    skin,
    chest: skin,
    waist: skin,
    pelvis: skin,
    shoulder: skin,
    upper: skin,
    fore: skin,
    hand: skin,
    thigh: skin,
    knee: skin,
    shin: skin,
    shoe: skin,
    sole: skin,
    neck: skin,
  }
  const parts: Part[] = [],
    decals: Decal[] = [],
    made: Record<string, Material> = {}
  let thighs = true,
    faceLook: FaceLook = { shape: m.face },
    form: ShoeForm | undefined
  // What the registered kinds are given, and the anchors they publish, each with the garment that made it.
  const state: Record<string, unknown> = {},
    anchors: { anchor: Anchor; from: Garment }[] = []
  const fit = bodyOf(m, s, ppm),
    c: Wearing = { m, s, garments, swatch, swatches, ppm, worn: parts, state, skin, body: fit }
  /** A kind's fit, applied in order: its parts, marks, materials, the regions it repaints, its openings. */
  const wear = (f: Fit, from: Garment) => {
    parts.push(...f.parts)
    decals.push(...(f.decals ?? []))
    Object.assign(made, f.materials)
    Object.assign(r, f.paint)
    for (const anchor of f.anchors ?? []) anchors.push({ anchor, from })
    if (f.thighs === false) thighs = false
    if (f.shoe) form = f.shoe
  }
  for (const item of garments) {
    // A registered kind (a fork's wardrobe); one worn last waits for the rest of the outfit.
    const kind = kindOf(item)
    if (kind) {
      if (!kind.last) wear(kind.build(c, item), item)
      continue
    }
    if ('top' in item) {
      r.chest = r.waist = item.top
      // A sleeveless top leaves the shoulder's round bare: the arm one surface of skin from the shoulder to the hand.
      if (item.sleeves !== 'none') r.shoulder = item.top
      if (item.sleeves !== 'none') r.upper = item.top
      if (item.sleeves === 'long') r.fore = item.top
      // The cuffs and the collar are sized from the body (fit.ts): a cuff hugs the arm (its girth and a texel's clearance); the
      // collar is fitted to the neck, today's placement its floor.
      if (item.cuffs)
        for (const [side] of sides) parts.push(cuff(side, item.cuffs, item.sleeves === 'long', m, s, fit))
      if (item.collar) for (const [, x] of sides) parts.push(collarPiece(x, item.collar, m, s, fit))
    } else if ('shorts' in item) {
      r.pelvis = r.thigh = item.shorts
    }
    // The hair: the generators' pieces (hair.ts), one surface, so the painter draws no line between them.
    else if ('hair' in item) {
      const style = typeof item.style === 'string' ? named(HAIR_STYLES, 'hair style', item.style) : item.style
      // The tie in the wearer's own palette: the one it names, else a band of the hair's own. The trunk the hair falls
      // clear of: the tops worn by now over the body's own torso.
      const tie = item.tie ?? hooks.tie?.(garments, swatches)
      const trunk = [...parts, ...body(m, s, r, thighs, undefined, fit.profiles)].filter(
        (p) => p.group === GROUP.torso,
      )
      // Headwear in the outfit: the hair is drawn under it, and pressed inside it where the headwear says how.
      const hat = garments.find((g) => kindOf(g)?.coversHair),
        cover = hat && kindOf(hat)!.coversHair!(c, hat)
      const hair = hairParts({ m, s, hair: item.hair, skin, swatch, capped: !!hat, ppm, tie, trunk }, style)
      parts.push(...(cover?.press ? cover.press(hair.parts) : hair.parts))
      decals.push(...hair.decals)
      Object.assign(made, hair.materials)
    } else if ('eyes' in item) {
      decals.push(...face(s, item.eyes, item.lids ?? 'lid', item.brows ?? 'brow'))
      faceLook = { shape: m.face, eyes: item.eyes, white: item.white, brows: item.brows, lips: item.lips }
      if (item.stubble)
        parts.push(
          box(
            J.head,
            item.stubble,
            GROUP.head,
            {
              at: [0, h * 0.12, hd * 0.52],
              r: [hw * 0.72, h * 0.12, hd * 0.5],
              e: [0.6, 0.65],
              taper: [0.7, 1],
            },
            { seam: FACE_SEAM },
          ),
        )
    }
  }
  // The kinds worn last, then each kind's `after`, both in garment order.
  for (const item of garments) {
    const kind = kindOf(item)
    if (kind?.last) wear(kind.build(c, item), item)
  }
  for (const item of garments) {
    const kind = kindOf(item)
    if (kind?.after) wear(kind.after(c, item), item)
  }
  Object.assign(made, earSkins(skin, swatch(skin)))
  // A shoe form's added parts come after every other part (the part index seeds the grain), on a shod foot only.
  const shod =
    r.shoe !== r.skin && form
      ? shoeExtras(
          m,
          s,
          { legs: fit.profiles.leg, clear: fit.clear, foot: fit.foot },
          r.shoe,
          r.sole,
          form,
          legGroup,
          (side) => SURFACE[legGroup(side)],
        )
      : []
  const all = [...body(m, s, r, thighs, ppm, fit.profiles, form), ...parts, ...shod]
  return {
    parts: all,
    decals,
    materials: made,
    face: faceLook,
    profiles: fit.profiles,
    anchors: hooks.anchors?.(c, anchors, all) ?? anchors.map((w) => w.anchor),
  }
}
/**
 * The face as a pixel artist draws it at this size: a texel per eye (two tall when afraid or surprised, a lid when
 * blinking), brows a texel above that slant with the mood, and a mouth that shows only when it means something.
 */
export const EXPRESSIONS = ['neutral', 'fear', 'surprised', 'sad', 'angry', 'talk', 'smile', 'dead'] as const
export type Expression = (typeof EXPRESSIONS)[number]
function face(s: Skeleton, eyes: string, lid: string, brow: string): Decal[] {
  const g = s.genes,
    hw = (g.head * g.headWidth) / 2,
    hd = (g.head * g.headDepth) / 2,
    h = g.head,
    front = hd * (1 + g.faceAhead) + 0.006
  const out: Decal[] = []
  for (const [, x] of sides) {
    const at: V3 = [x * hw * 0.42, h * 0.45, front],
      normal: V3 = [x * 0.5, 0, 0.86]
    out.push(
      { bone: J.head, at, normal, material: eyes, when: ['neutral', 'sad', 'angry', 'talk'], blink: false },
      {
        bone: J.head,
        at: [at[0], h * 0.47, front],
        normal,
        material: eyes,
        size: [1, 2],
        when: ['fear', 'surprised'],
        blink: false,
      },
      { bone: J.head, at, normal, material: lid, blink: true },
      // Brows: worried (fear, sad) lifts the inner end, angry drops it.
      { bone: J.head, at: [x * hw * 0.25, h * 0.6, front], normal, material: brow, when: ['fear', 'sad'] },
      {
        bone: J.head,
        at: [x * hw * 0.52, h * 0.56, front],
        normal,
        material: brow,
        when: ['fear', 'sad', 'angry'],
      },
      { bone: J.head, at: [x * hw * 0.25, h * 0.53, front], normal, material: brow, when: ['angry'] },
    )
  }
  out.push(
    {
      bone: J.head,
      at: [0, h * 0.2, hd * 0.86],
      normal: [0, -0.2, 1],
      material: 'mouth',
      when: ['fear', 'surprised', 'mouthOpen'],
    },
    {
      bone: J.head,
      at: [0, h * 0.22, hd * 0.86],
      normal: [0, -0.2, 1],
      material: 'mouth',
      size: [2, 1],
      when: ['sad', 'angry'],
    },
  )
  // Tagged, so a figure whose face the painter draws leaves them all out (figure.ts).
  return out.map((d) => ({ ...d, tag: 'face' }))
}
