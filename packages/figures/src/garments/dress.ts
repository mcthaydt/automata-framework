// Dresses a body: the garments in order repaint regions and add parts, streetwear from its registry, hair,
// caps and the face's marks here; then the body is built under them. Every size comes from the measure.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`dress`,
// its hair, cap and eyes branches), with AF's strict types; the order of the garments and of the parts is the
// source's. Changed: libraries come in as arguments (no library in code); painter materials are swatch
// variants; the drawn face (`FaceLook`) is not taken; a hair garment with no style wears the figure's
// `hairPieces` (M3.5b decision 6).

import type { Anchor } from '../build/anchors'
import type { Made } from '../build/materials'
import type { Classic, Garment, HairGarment } from '../figure/garment.schema'
import type { Measure } from '../genes/genes'
import { capParts, underCap } from '../hair/cap'
import { hairParts } from '../hair/hair-parts'
import { HAIR_SEAM } from '../hair/skull'
import type { HairStyle } from '../library/hair.schema'
import type { Headwear, Lock } from '../library/headwear.schema'
import type { Swatch } from '../library/swatch.schema'
import type { V3 } from '../math/math'
import { type Decal, GROUP, type Part } from '../parts/mesh'
import { J, type Skeleton } from '../rig/rig'
import { GARMENTS, garmentOf, reachable } from '../streetwear/registry'
import type { Fit } from '../streetwear/under'
import { body, legGroup, type Regions } from './body'
import { type Dressing, wearClassic } from './classic'
import { face } from './face'
import { FACE_SEAM, SIDES } from './head'
import { box, lockParts, named } from './locks'

/** The libraries a body is dressed from: its swatches, hair styles and headwear, by id. */
export interface Wardrobe {
  readonly swatches: Readonly<Record<string, Swatch>>
  readonly hair: Readonly<Record<string, HairStyle>>
  readonly headwear: Readonly<Record<string, Headwear>>
}

/**
 * A dressed body: its parts and marks, and the openings a hand can reach (every pocket and hem no outer
 * garment covers).
 */
export interface Look {
  parts: Part[]
  decals: Decal[]
  anchors: Anchor[]
}

/** The hair styles a hair garment wears: its own, or with none, the figure's `hairPieces`. */
function stylesOf(
  item: HairGarment,
  wardrobe: Wardrobe,
  hairPieces: readonly string[] | undefined,
): HairStyle[] {
  const toStyle = (style: string | HairStyle | readonly Lock[]): HairStyle =>
    typeof style === 'string'
      ? named(wardrobe.hair, 'hair style', style)
      : Array.isArray(style)
        ? { locks: style }
        : (style as HairStyle)
  if (item.style !== undefined) return [toStyle(item.style)]
  if (!hairPieces?.length)
    throw new Error(`a hair garment with no style wears the figure's hairPieces, and this figure has none`)
  return hairPieces.map(toStyle)
}

export function dress(
  m: Measure,
  s: Skeleton,
  skin: string,
  garments: readonly Garment[],
  wardrobe: Wardrobe,
  made: Made,
  hairPieces?: readonly string[],
): Look {
  const g = s.genes
  const k = m.k
  const hw = (g.head * g.headWidth) / 2
  const hd = (g.head * g.headDepth) / 2
  const h = g.head
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
  const parts: Part[] = []
  const decals: Decal[] = []
  const d: Dressing = {
    m,
    s,
    garments,
    r,
    parts,
    decals,
    thighs: true,
    front: 0.1 * k * m.thick * m.depth,
    boots: false,
    outer: { waist: 0, hem: 0 },
  }
  /** A streetwear garment's fit: its parts, marks, the regions it repaints, its openings. */
  const anchors: { anchor: Anchor; from: Garment }[] = []
  const wear = (f: Fit, from: Garment) => {
    parts.push(...f.parts)
    decals.push(...(f.decals ?? []))
    Object.assign(r, f.paint)
    for (const anchor of f.anchors ?? []) anchors.push({ anchor, from })
  }
  const fitOf = (kind: string, item: Garment) => {
    const entry = GARMENTS[kind]
    if (!entry) throw new Error(`no garment ${kind}`)
    return entry.build({ m, s, garments, made, worn: parts }, item)
  }
  for (const item of garments) {
    // Streetwear, from the registry; one worn last waits for the rest of the outfit.
    const kind = garmentOf(item)
    if (kind) {
      if (!GARMENTS[kind]?.last) wear(fitOf(kind, item), item)
      continue
    }
    if ('hair' in item) {
      // The hair: the generators' pieces, or rounded locks, one surface.
      for (const style of stylesOf(item, wardrobe, hairPieces)) {
        if (style.pieces) {
          const hat = garments.find((x): x is Extract<Garment, { cap: string }> => 'cap' in x)
          const cap = hat && named(wardrobe.headwear, 'headwear', hat.style).cap
          // The tie in the wearer's own palette: the one it names, else the outfit's metal, else a band of
          // the hair's own. The trunk the hair falls clear of: the tops worn by now over the body's own
          // torso.
          const tie =
            item.tie ??
            garments
              .flatMap((x) => Object.values(x))
              .find((v): v is string => typeof v === 'string' && wardrobe.swatches[v]?.kind === 'metal')
          const trunk = [...parts, ...body(m, s, r, d.thighs, {})].filter((p) => p.group === GROUP.torso)
          const hair = hairParts(
            { m, s, hair: item.hair, skin, made, capped: !!hat, tie, trunk },
            { about: style.about, pieces: style.pieces, finish: style.finish },
          )
          // Under a cap the hair is pressed inside its dome, so no style stands through it.
          parts.push(...(cap ? underCap(m, s, cap, hair.parts) : hair.parts))
          decals.push(...hair.decals)
        }
        if (style.locks)
          parts.push(
            ...lockParts(s, k, item.hair, GROUP.hair, style.locks).map((p) => ({ ...p, seam: HAIR_SEAM })),
          )
      }
    } else if ('cap' in item) {
      const headwear = named(wardrobe.headwear, 'headwear', item.style)
      if (headwear.cap) {
        const cap = capParts(m, s, item.cap, headwear.cap, made, item.mark)
        parts.push(...cap.parts)
        decals.push(...cap.decals)
      }
      if (headwear.locks) parts.push(...lockParts(s, k, item.cap, GROUP.hair, headwear.locks))
      const mark = item.mark
      if (mark && headwear.mark) {
        const { at, atk = [0, 0, 0], normal, sizes } = headwear.mark
        const place: V3 = [hw * at[0] + k * atk[0], h * at[1] + k * atk[1], hd * at[2] + k * atk[2]]
        for (const size of sizes ?? [undefined])
          decals.push({
            bone: J.head,
            at: place,
            normal: [...normal],
            material: mark,
            ...(size ? { size: [...size] } : {}),
          })
      }
    } else if ('eyes' in item) {
      decals.push(...face(s, item.eyes, item.lids ?? 'lid', item.brows ?? 'brow'))
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
    } else wearClassic(d, item as Classic)
  }
  for (const item of garments) {
    const kind = garmentOf(item)
    if (kind && GARMENTS[kind]?.last) wear(fitOf(kind, item), item)
  }
  if (d.boots)
    for (const [side] of SIDES)
      parts.push(
        box(J[`shin.${side}`], r.shoe, legGroup(side), {
          at: [0, -s.shin * 0.8, 0],
          r: [0.07 * k * m.thick * m.leg, s.shin * 0.22, 0.075 * k * m.thick * m.leg],
          taper: [1, 0.92],
          e: [0.5, 0.6],
        }),
      )
  return {
    parts: [...body(m, s, r, d.thighs, made), ...parts],
    decals,
    anchors: reachable(m, s, garments, anchors),
  }
}
