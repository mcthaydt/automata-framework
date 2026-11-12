// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 23 of the builders-fold plan (the strict flags) replaces each with a check

import { GROUP, type Material } from '../body/parts'
import { depthAt, labelAt, type Weave } from './fabric'
import { budget, isLeg, LINE, lightTexels, MIRROR, OUTLINE, RIM, tint } from './paint-budget'
import { detailFloor, outlines, stainsAndHolo } from './paint-detail'
import type { FaceStamp } from './paint-face'
import type { Bends, HandStamp } from './paint-hands'
import type { Cloth } from './paint-prepare'
import { type PaintInputs, prepare } from './paint-prepare'
import { stampFace } from './paint-stamp'
import { EDGE_LEVELS, PAINT, type PaintStyle } from './paint-style'
import { faceForm, keyLight, quiltedBands, smoothSurfaces } from './paint-surface'
import { clusterTones, polishTones, ruleLines, toneTexels } from './paint-tones'
import { type GBuffer, noise3 } from './raster'
import { tiled } from './row'

export {
  densityOf,
  familyTones,
  GLOSS_SHEEN,
  SHEEN_MAX,
  SHEEN_MIN,
  sheenScale,
} from './paint-budget'
export type { FaceStamp } from './paint-face'
export { eyeWhite } from './paint-face'
export type { Bends, HandStamp } from './paint-hands'
export type { PaintStyle } from './paint-style'
export { duel, FACE_SEAM, oklab, PAINT, rampOf, tonesOf } from './paint-style'

/**
 * Paints the cell: `albedo` (RGBA) and `normals` (RGBA, red right, green down, blue toward the camera). `skin` is the
 * skin's material (it takes no cloth folds), −1 for none.
 *
 * - The outline sits just outside each shape (an empty texel beside the figure, or a far surface's texel beside a nearer
 *   part of another group), one texel and 8-connected, so a form keeps its width and a thin wrist keeps its colour. On
 *   the silhouette it is selective: toward the key, the shape's own line tone; away from it and underneath, ink. Inside
 *   the figure it is the far surface's own fold, and it runs whole or not at all.
 * - The key light on normals smoothed over each surface (a wider brush at higher density), cut into clusters: a tone
 *   island smaller than `cluster` joins its neighbours. Cloth's terminator wanders with its folds.
 * - Form: a crevice tone where a nearer part sits beside, a cast shadow where one stands between the surface and the key,
 *   reflected light on the shadow side's edge, and a glossy material's shine where it mirrors the key.
 */
export function paint(
  g: GBuffer,
  materials: Material[],
  albedo: Uint8ClampedArray,
  normals: Uint8ClampedArray,
  face: FaceStamp | null,
  style: PaintStyle = PAINT,
  skin = face?.skin ?? -1,
  hands: HandStamp[] = [],
  bends: Bends = {},
  light?: Float32Array,
  cloth?: Cloth,
  weaveOut?: Weave,
): { albedo: Uint8ClampedArray; normals: Uint8ClampedArray; weave: Weave | null } {
  const c0: PaintInputs = {
    g,
    materials,
    albedo,
    normals,
    face,
    style,
    skin,
    hands,
    bends,
    light,
    cloth,
    weaveOut,
  }
  const c1 = { ...c0, ...prepare(c0) }
  const c2 = { ...c1, ...smoothSurfaces(c1) }
  const c3 = { ...c2, ...faceForm(c2) }
  const c4 = { ...c3, ...keyLight(c3) }
  const c5 = { ...c4, ...quiltedBands(c4) }
  const c6 = { ...c5, ...toneTexels(c5) }
  polishTones(c6)
  const c7 = { ...c6, ...ruleLines(c6) }
  const c8 = { ...c7, ...clusterTones(c7) }
  detailFloor(c8)
  outlines(c8)
  const c9 = { ...c8, ...stainsAndHolo(c8) }
  // @cut-head-end: the names below are what the statements still in paint() read of the phases cut so far
  const {
    D,
    P,
    depth,
    edges,
    extra,
    fabrics,
    group,
    h,
    handTone,
    hue,
    ink,
    material,
    n,
    owner,
    part,
    ppm,
    skinny,
    slotOf,
    sm,
    stains,
    through,
    tone,
    tones,
    w,
    wash,
    weave,
  } = c9
  for (let k = 0; k < n; k++) {
    const o = k * 4,
      t = tone[k]
    if (t === -2) {
      albedo[o + 3] = 0
      normals[o] = 128
      normals[o + 1] = 128
      normals[o + 2] = 255
      normals[o + 3] = 0
      continue
    }
    // A line inside the figure is the far surface's own (its fold, its normal); one outside, its shape's.
    const at = t >= OUTLINE && material[k] < 0 ? owner[k] : k,
      mi = material[at]
    let ramp = tones[mi]
    // Sheer cloth is denser where it turns from the eye: the share's level from how far this texel's normal is from facing it.
    const sheer = edges[mi]
    if (sheer && t < OUTLINE)
      ramp = sheer[Math.round((EDGE_LEVELS - 1) * (1 - Math.max(0, sm[at * 3 + 2])) ** 2)]
    const stain = materials[mi].stain
    let tt: number = t
    if (stain && t < OUTLINE) {
      const q = k * 3,
        up = (P[q + 1] - stain.hem) / (stain.below - stain.hem),
        gr = group[k]
      if (isLeg(gr) || gr === GROUP.torso) {
        const worn = isLeg(gr) ? wash(k, up, stain) : 0
        if (worn) {
          ramp = stains[mi]!
          tt = worn === 3 ? Math.max(Math.min(t, 3) - 1, 0) : t
        }
        // On hanging cloth (a skirt's hem): surely at the hem, ever less often up to its top, in runs that climb (noise
        // tall in y, fine across), on the cloth's own surface so it never swims.
      } else if (up < 1 && noise3(P[q] * 34, P[q + 1] * 5, P[q + 2] * 34) > Math.max(0, up) ** 0.7 * 0.85)
        ramp = stains[mi]!
    }
    if (hue[k] >= MIRROR) {
      ramp = tint(ramp)
      tt = hue[k] - MIRROR
    } else if (hue[k] >= 0) tt = hue[k]
    // Lit from outside: the key's bands are gone, so a light or dark key tone reads mid (3 deep stays).
    else if (light && t >= 0 && t <= 2) tt = 1
    // A fabric's tile (H5): a step along the material's own ramp by the tile's label, on cloth's own surface only. Not shine,
    // a line, the rim or the outline; not a holo hue, a mark or a print, a hand, or a texel the painter refilled (the
    // cloth channel follows the raster's surface, not the painter's copy). The head and held items have no cylinder.
    const fab = fabrics[mi]
    if (
      fab &&
      t >= 0 &&
      t <= 3 &&
      hue[k] < 0 &&
      at === k &&
      part[k] >= 0 &&
      part[k] === g.part[k] &&
      material[k] === g.material[k] &&
      handTone[k] < 0
    ) {
      let u = cloth!.u(group[k], cloth!.place[k * 3], cloth!.place[k * 3 + 1])
      // A handed tile (fabric.ts): the left limbs' `u` runs against the trunk's and the right limbs', so it is read negated.
      if (u !== null && fab.handed && (group[k] === GROUP.armL || group[k] === GROUP.legL)) u = -u
      if (u !== null) {
        weave!.labels[k] = labelAt(fab, u, cloth!.place[k * 3 + 2], ppm)
        weave!.on[k] = slotOf[mi]
      }
    }
    if (materials[mi].see && t < OUTLINE && (hue[k] >= MIRROR || materials[mi].holo !== 'mirror'))
      through.set(k, tint(tones[mi]))
    const c =
      t === OUTLINE
        ? at === k
          ? extra[mi].fold
          : ink
        : t === LINE
          ? extra[mi].line
          : t === RIM
            ? extra[mi].rim
            : t === -1
              ? extra[mi].shine
              : ramp[Math.min(tt, ramp.length - 1)]
    albedo[o] = (c >> 16) & 255
    albedo[o + 1] = (c >> 8) & 255
    albedo[o + 2] = c & 255
    albedo[o + 3] = 255
    normals[o] = Math.round((sm[at * 3] + 1) * 127.5)
    normals[o + 1] = Math.round((1 - sm[at * 3 + 1]) * 127.5)
    normals[o + 2] = Math.round((sm[at * 3 + 2] + 1) * 127.5)
    normals[o + 3] = 255
  }
  // The face reads the tones: an outline texel (9) is never the face's.
  const fixed = tone.map((v) => (v >= OUTLINE ? 9 : v))
  const kept = new Uint8Array(n)
  for (let k = 0; k < n; k++) if (tone[k] === -1 || hue[k] >= 0) kept[k] = 1
  if (face)
    stampFace(
      face,
      { ...g, material, part, group, depth },
      tones[face.skin],
      albedo,
      fixed,
      through,
      kept,
      (m) => skinny[m],
    )
  budget(albedo, w, h, D, kept, (k: number) => material[tone[k] >= OUTLINE && material[k] < 0 ? owner[k] : k])
  if (light) lightTexels(light, g, albedo, D)
  if (weave) {
    // The tile, last: the ground as painted, budgeted and lit, then a step along its own row by the label (row.ts tiled).
    weave.ground.set(albedo)
    for (let k = 0; k < n; k++) {
      if (!weave.on[k]) continue
      const o = k * 4,
        c = tiled(
          (albedo[o] << 16) | (albedo[o + 1] << 8) | albedo[o + 2],
          weave.labels[k],
          ...depthAt(weave, k),
        )
      albedo[o] = (c >> 16) & 255
      albedo[o + 1] = (c >> 8) & 255
      albedo[o + 2] = c & 255
    }
  }
  return { albedo, normals, weave }
}
