// `build(def, skeleton, outfit, item, library)`: a figure's part meshes for one outfit and one held item, each bound to
// a joint (rigid on one bone, or skinned to several), with the materials they name as palette colours, the face's and
// the garments' marks as anchor points, the openings a hand can reach and how far the arms hang out to clear the outfit.
// It is pure: it reads its arguments and writes nothing, so swapping an outfit rebuilds the part list from the same
// skeleton and changes no joint (F-d). The view draws the result. The item parts are FigureBuilder's
// (mcthaydt/FigureBuilder) src/render/figure/cast.ts `item` at a1f7246 (each a rounded box on the holding hand's
// socket); `build` itself is new here, in place of `fromDef`'s dressing step (the libraries are arguments, not code).

import { axisAngle } from '../../../shared/math/math.ts'
import { measure } from '../body/genes.ts'
import { type Decal, GROUP, type Part } from '../body/mesh.ts'
import { J, type Skeleton } from '../body/rig.ts'
import type { HairStyle } from '../content/hair.schema.ts'
import type { Headwear } from '../content/headwear.schema.ts'
import type { ItemDef } from '../content/item.schema.ts'
import type { Swatch } from '../content/swatch.schema.ts'
import { dress } from '../outfit/garments/dress.ts'
import { box } from '../outfit/garments/locks.ts'
import { type Anchor, clearance } from './anchors.ts'
import type { FigureDef } from './figure.schema.ts'
import { type BuiltMaterial, type Made, resolveMaterials } from './materials.ts'

/** The libraries a figure draws on, by id, as compiled content holds them. */
export interface FigureLibrary {
  readonly swatches: Readonly<Record<string, Swatch>>
  readonly hair: Readonly<Record<string, HairStyle>>
  readonly headwear: Readonly<Record<string, Headwear>>
  readonly items: Readonly<Record<string, ItemDef>>
}

/** A built figure: what the view draws and what the stands place hands against. */
export interface Built {
  /** Each part's mesh in its bone's space (rigid) or in rest figure space (skinned), and its material. */
  parts: Part[]
  /** Point marks (the face, buttons, zips, stitches) on their bones, for the view to draw as small quads. */
  decals: Decal[]
  /** Every material a part or a decal names, as a palette colour. */
  materials: Record<string, BuiltMaterial>
  /** The openings a hand can reach, in rest figure space. */
  anchors: Anchor[]
  /** The least each arm (L, R) hangs out from the body (rad) to clear the outfit. */
  clearance: [number, number]
}

/** An item's parts, each a rounded box in its socket's space (+z up when held upright). */
function itemParts(def: ItemDef, socket: number): Part[] {
  return def.parts.map((p) =>
    box(socket, p.material, GROUP.item, {
      at: [...p.at],
      r: [...p.r],
      ...(p.e ? { e: [...p.e] } : {}),
      ...(p.seg ? { seg: p.seg } : {}),
      ...(p.rings ? { rings: p.rings } : {}),
      ...(p.pitch !== undefined ? { turn: axisAngle([1, 0, 0], p.pitch) } : {}),
    }),
  )
}

export function build(
  def: FigureDef,
  skeleton: Skeleton,
  outfit: string,
  item: string | null,
  library: FigureLibrary,
): Built {
  const garments = def.outfits[outfit]
  if (garments === undefined)
    throw new Error(`no outfit ${outfit} (outfits: ${Object.keys(def.outfits).join(', ')})`)
  // The garments are sized from the measure, on the skeleton's genes (the figure's own overrides included).
  const m = { ...measure(def.sliders), genes: skeleton.genes }
  const made: Made = {}
  const look = dress(m, skeleton, def.skin, garments, library, made, def.hairPieces)
  const parts = [...look.parts]
  if (item !== null) {
    const held = library.items[item]
    if (held === undefined) throw new Error(`no item ${item}`)
    parts.push(...itemParts(held, J[`socket.${def.hand}`]))
  }
  const materials = resolveMaterials(
    [...parts.map((p) => p.material), ...look.decals.map((d) => d.material)],
    made,
    library.swatches,
  )
  return {
    parts,
    decals: look.decals,
    materials,
    anchors: look.anchors,
    // The arms clear the dressed body, the head and a held item aside (FigureBuilder cast.ts fromDef's look).
    clearance: clearance(skeleton, look.parts, { L: GROUP.armL, R: GROUP.armR }, [GROUP.head, GROUP.item]),
  }
}
