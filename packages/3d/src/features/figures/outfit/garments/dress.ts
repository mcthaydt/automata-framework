// Dresses a body: the garments in order repaint regions and add parts, each worn by its registered kind (the
// classic set, streetwear, an extension's wardrobe), then the body is built under them. Every size comes from
// the measure.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`dress`),
// with AF's strict types; the order of the garments and of the parts is the source's. Changed: libraries come in
// as arguments (no library in code); painter materials are swatch variants; the drawn face (`FaceLook`) is not
// taken; the kinds are told apart by the garment registry, not by a branch for each.

import type { Measure } from '../../body/genes.ts'
import { type Decal, GROUP, type Part } from '../../body/mesh.ts'
import { type Body, bodyOf } from '../../body/profiles.ts'
import { J, type Skeleton } from '../../body/rig.ts'
import type { Anchor } from '../../figure/anchors.ts'
import type { Garment } from '../../figure/garment.schema.ts'
import type { Made } from '../../figure/materials.ts'
import { GARMENTS, type GarmentKind, garmentOf } from '../../registry/garment-registry.ts'
import { outfitHooks } from '../../registry/outfit-hooks-registry.ts'
import { reachable } from '../streetwear/registry.ts'
import type { Fit } from '../streetwear/under.ts'
import { body, legGroup, type Regions } from './body.ts'
import type { Dressing, Wardrobe } from './classic.ts'
import './classic-kinds.ts'
import { SIDES } from './head.ts'
import { box } from './locks.ts'

/**
 * A dressed body: its parts and marks, and the openings a hand can reach (every pocket and hem no outer
 * garment covers).
 */
export interface Look {
  parts: Part[]
  decals: Decal[]
  anchors: Anchor[]
}

/** The registered kind of an item; an item no kind claims is refused, naming its keys. */
function kindOf(item: Garment): GarmentKind {
  const name = garmentOf(item)
  const kind = name === undefined ? undefined : GARMENTS[name]
  if (!kind) throw new Error(`No garment called "${Object.keys(item)[0] ?? ''}" is registered`)
  return kind
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
  const k = m.k
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
  const fit: Body = bodyOf(m, s)
  const d: Dressing = {
    m,
    s,
    body: fit,
    garments,
    wardrobe,
    made,
    hairPieces,
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
  const fitOf = (name: string, item: Garment) => {
    const build = GARMENTS[name]?.build
    if (!build) throw new Error(`The garment called "${name}" has no way to be built`)
    return build({ m, s, garments, made, worn: parts, body: fit }, item)
  }
  for (const item of garments) {
    const kind = kindOf(item)
    if (kind.wear) kind.wear(d, item)
    else if (!kind.last) wear(fitOf(garmentOf(item) as string, item), item)
  }
  for (const item of garments) {
    const kind = kindOf(item)
    if (!kind.wear && kind.last) wear(fitOf(garmentOf(item) as string, item), item)
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
  const dressed = [...body(m, s, r, d.thighs, made), ...parts]
  const pickAnchors = outfitHooks().anchors
  return {
    parts: dressed,
    decals,
    anchors: pickAnchors ? pickAnchors(anchors, dressed) : reachable(m, s, garments, anchors),
  }
}
