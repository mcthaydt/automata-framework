// One painted cell from a posed figure: the triangle soup is drawn supersampled into a G-buffer, resolved to the cell,
// cleaned the way a pixel artist cleans it, stamped with the marks, and painted. This is the whole path from a soup
// to the colours, the normal map and the depth of a sprite cell.

import { GROUP } from '../body/mesh.ts'
import type { PainterMaterial } from '../figure/materials.ts'
import type { FaceStamp } from './face-stamp.ts'
import type { Bends, HandStamp } from './hand-stamp.ts'
import { paint } from './paint.ts'
import type { Cloth } from './paint-state.ts'
import {
  blendJoins,
  cleanup,
  type GBuffer,
  gbuffer,
  neckline,
  rasterize,
  resolve,
  type Soup,
  STYLE,
  type Style,
  smoothContour,
  VERT,
} from './raster.ts'
import { stamp, stampPrint, type ViewDecal } from './stamps.ts'

/** What the painter needs to know about a figure's cloth when a material names a fabric. */
export interface ClothInput {
  /** Each soup vertex's cloth slots (`cos t`, `sin t`, `-y`), three floats a vertex. */
  readonly slots: Float32Array
  /** Metres round a group's cylinder at a texel's `(cos t, sin t)`, or null for an untiled group. */
  u(group: number, c: number, s: number): number | null
}

export interface CellInput {
  readonly soup: Soup
  readonly decals: readonly ViewDecal[]
  readonly materials: readonly PainterMaterial[]
  readonly face: FaceStamp | null
  readonly hands: readonly HandStamp[]
  readonly bends: Bends
  readonly cloth?: ClothInput | undefined
  /** The cell's width and height in texels. */
  readonly cell: readonly [number, number]
  /** The feet's texel in the cell. */
  readonly feet: readonly [number, number]
  /** The figure's height in metres, which sizes a texel for the marks' depth test. */
  readonly metres: number
  /** The G-buffer part ids of the neck (parts tagged as the neck), for the neckline rule. */
  readonly neck: ReadonlySet<number>
  /** The skin's material index, −1 for none. */
  readonly skin: number
  /** The rasteriser's knobs; the painter's own when left out. */
  readonly style?: Style | undefined
}

export interface PaintedCell {
  readonly width: number
  readonly height: number
  readonly feet: readonly [number, number]
  /** RGBA, straight; alpha 0 where the cell is empty. */
  readonly colours: Uint8ClampedArray
  /** RGBA normal map: a normal's x, y, z as 0 to 255, alpha 0 where there is none. */
  readonly normals: Uint8ClampedArray
  /** Metres toward the camera at each texel; larger is nearer. */
  readonly depth: Float32Array
  /** The material at each texel, −1 for none (the sprite light reads it for ink and eyes). */
  readonly material: Int16Array
}

/** Rasterises `soup` with its place slots replaced, to read a per-vertex value back per texel. */
function placed(soup: Soup, slots: Float32Array): Soup {
  const verts = soup.verts.slice(0, soup.count * VERT)
  for (let v = 0; v < soup.count; v++)
    for (let i = 0; i < 3; i++) verts[v * VERT + 6 + i] = slots[v * 3 + i] ?? 0
  return { ...soup, verts }
}

export function paintCell(input: CellInput): PaintedCell {
  const style = input.style ?? STYLE
  const [w, h] = input.cell
  const S = style.supersample
  const hi = gbuffer(w * S, h * S)
  const g = gbuffer(w, h)
  const cleaned = (buffer: GBuffer): void => {
    if (!style.cleanup) return
    cleanup(buffer)
    blendJoins(buffer)
    smoothContour(buffer)
    neckline(buffer, input.neck as Set<number>)
  }
  rasterize(input.soup, hi)
  resolve(hi, g, S, style)
  cleaned(g)

  // With a fabric in use, a second raster of the same triangles carries each vertex's cloth slots in the place slots,
  // resolved and cleaned as the first is, so it follows it texel for texel.
  let cloth: Cloth | undefined
  if (input.cloth) {
    const clothHi = gbuffer(w * S, h * S)
    const clothG = gbuffer(w, h)
    rasterize(placed(input.soup, input.cloth.slots), clothHi)
    resolve(clothHi, clothG, S, style)
    cleaned(clothG)
    cloth = { place: clothG.place, u: input.cloth.u }
  }

  // A print on a surface goes on before the marks (they find the surface by its part), one hung over it (a pendant)
  // after, over every mark on the cloth behind it.
  for (const d of input.decals) if (d.print?.seams) stampPrint(d, g)
  stamp(
    input.decals.filter((d) => !d.print),
    g,
    input.metres / h,
    [GROUP.item],
  )
  for (const d of input.decals) if (d.print && !d.print.seams) stampPrint(d, g)

  const colours = new Uint8ClampedArray(w * h * 4)
  const normals = new Uint8ClampedArray(w * h * 4)
  paint(
    g,
    [...input.materials],
    colours,
    normals,
    input.face,
    undefined,
    input.skin,
    [...input.hands],
    input.bends,
    cloth,
  )
  return { width: w, height: h, feet: input.feet, colours, normals, depth: g.depth, material: g.material }
}
