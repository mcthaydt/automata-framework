import type { Material } from '../body/parts'
import { depthOf, type Fabric, fabricOf, newWeave, type Weave } from './fabric'
import { DARK_MID, densityOf, edgeTonesOf, extraTones, fillTones, INK_RGB } from './paint-budget'
import type { FaceStamp } from './paint-face'
import { type Bends, drawHands, type HandStamp } from './paint-hands'
import { duel, HAIR_SEAMS, hex, oklab, type PaintStyle, tonesOf } from './paint-style'
import type { GBuffer } from './raster'

/** The cloth channel (figure/cloth.ts), for a fabric (fabric.ts): each texel's `(cos t, sin t, v)` as the figure's third raster
 * drew it, and `u(group, cos, sin)`, the metres round the group's cylinder (null for an untiled group). */
export interface Cloth {
  place: Float32Array
  u(group: number, c: number, s: number): number | null
}
/** The fabrics of a paint with no cloth channel: none (an index reads undefined), with no array built per call. */
const NO_FABRICS: readonly (Fabric | null)[] = []

/** What `paint()` is called with, defaults filled in: the context the first phase reads, and the start of the one every
 * later phase reads (each phase returns the names it declares, and `paint()` adds them to the context). */
export interface PaintInputs {
  g: GBuffer
  materials: Material[]
  albedo: Uint8ClampedArray
  normals: Uint8ClampedArray
  face: FaceStamp | null
  style: PaintStyle
  skin: number
  hands: HandStamp[]
  bends: Bends
  light: Float32Array | undefined
  cloth: Cloth | undefined
  weaveOut: Weave | undefined
}

/**
 * The tone tables of the materials, their fabrics (H5), the skin's family and the dark ramps, the painter's own copy of
 * the G-buffer's surfaces, and the hands drawn into it (drawHands).
 */
export function prepare(ctx: PaintInputs) {
  const { cloth, g, hands, materials, skin, style, weaveOut } = ctx
  const { w, h } = g,
    n = w * h,
    ink = INK_RGB
  const tones = materials.map((m) => fillTones(tonesOf(m), m.flat ? 0 : style.cool)),
    D = densityOf(w),
    ppm = 36.9 * D
  // A sheer material (`mix.edge`): its tones at each level of edge; none for any other, which run today's code.
  const edges = materials.map((m) => edgeTonesOf(m, style.cool))
  // The fabrics (H5) of the materials; with no cloth channel, none is read.
  const fabrics = cloth ? materials.map((m) => (m.fabric ? (fabricOf(m.fabric) ?? null) : null)) : NO_FABRICS
  // The tile goes on last (after the budget and the light), so the loop below paints each tiled texel's ground and keeps its
  // label here (`weave.on`); with no cloth channel there is none.
  const depths = fabrics.map((f) => (f ? depthOf(f) : null))
  const weave = cloth ? (weaveOut ?? newWeave(n)) : null
  if (weave) weave.depths.length = 0
  // A texel's `on` is 1 + the index of its fabric's depth in the weave's table (one pair per distinct depth).
  const slotOf = depths.map((d) => {
    if (!d || !weave) return 0
    let i = weave.depths.findIndex((p) => p[0] === d[0] && p[1] === d[1])
    if (i < 0) i = weave.depths.push(d) - 1
    return i + 1
  })
  if (weave) {
    weave.labels.fill(0)
    weave.on.fill(0)
  }
  // The skin's family: the skin, and any surface painted in its tones alone (an ear's rim and bowl), which takes its line.
  const skinSet = new Set(skin >= 0 ? tones[skin] : []),
    skinny = tones.map((t, i) => i === skin || (skin >= 0 && t.every((c) => skinSet.has(c))))
  // Black cloth (a dark ramp, not skin, hair or a flat mark) has its own darks and form (extraTones, the rim below).
  const hairy = (p: number) => p >= HAIR_SEAMS[0] && p < HAIR_SEAMS[1],
    onHair = new Uint8Array(materials.length)
  for (let k = 0; k < n; k++) if (g.material[k] >= 0 && hairy(g.part[k])) onHair[g.material[k]] = 1
  const darkRamp = materials.map(
    (m, i) => !m.strands && !m.flat && !skinny[i] && !onHair[i] && oklab(tones[i][1])[0] < DARK_MID,
  )
  const extra = tones.map((t, i) => extraTones(t, materials[i].ramp, skinny[i], darkRamp[i]))
  const stains = materials.map((m) =>
    m.stain
      ? fillTones(
          m.stain.paint.map((c) => duel(hex(c))),
          0,
        )
      : null,
  )
  // The painter's own copy of the G-buffer's surfaces (the raster's stays as drawn, for the re-shade).
  const material = g.material.slice(),
    part = g.part.slice(),
    group = g.group.slice(),
    depth = g.depth.slice(),
    normal = g.normal.slice(),
    place = g.place.slice()
  // The hands, designed (drawHands): their texels' tones are theirs.
  const handTone = drawHands(hands, w, h, D, { material, part, group, depth, normal, place })
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && material[y * w + x] >= 0
  return {
    w,
    h,
    n,
    ink,
    tones,
    D,
    ppm,
    edges,
    fabrics,
    weave,
    slotOf,
    skinny,
    hairy,
    darkRamp,
    extra,
    stains,
    material,
    part,
    group,
    depth,
    normal,
    place,
    handTone,
    filled,
  }
}

/** The context once `prepare` has run. */
export type AfterPrepare = PaintInputs & ReturnType<typeof prepare>
