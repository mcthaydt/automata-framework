// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 23 of the builders-fold plan (the strict flags) replaces each with a check

import { GROUP, type Material } from '../body/parts'
import { smooth } from '../math/math'
import { depthAt, depthOf, type Fabric, fabricOf, labelAt, newWeave, type Weave } from './fabric'
import {
  budget,
  DARK_MID,
  densityOf,
  edgeTonesOf,
  extraTones,
  fillTones,
  GLOSS_SHEEN,
  INK_RGB,
  isArm,
  isLeg,
  K2,
  LINE,
  lightTexels,
  MIRROR,
  MIRROR_SKY,
  OUTLINE,
  RIM,
  RISE,
  SHEEN,
  SHEEN_MAX,
  SHEEN_MIN,
  sheenScale,
  tint,
  touching,
} from './paint-budget'
import { type FaceStamp, facePlane, onForm } from './paint-face'
import { type Bends, drawHands, type HandStamp } from './paint-hands'
import { stampFace } from './paint-stamp'
import {
  duel,
  EDGE_LEVELS,
  FACE_DEEP,
  FACE_KEY,
  FACE_SEAM,
  HAIR_SEAMS,
  hex,
  KEY,
  LIGHT,
  oklab,
  PAINT,
  type PaintStyle,
  tonesOf,
} from './paint-style'
import { type GBuffer, noise3 } from './raster'
import { tiled } from './row'

export {
  DARK_SHINE,
  darkOf,
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
/** The cloth channel (figure/cloth.ts), for a fabric (fabric.ts): each texel's `(cos t, sin t, v)` as the figure's third raster
 * drew it, and `u(group, cos, sin)`, the metres round the group's cylinder (null for an untiled group). */
export interface Cloth {
  place: Float32Array
  u(group: number, c: number, s: number): number | null
}
/** The fabrics of a paint with no cloth channel: none (an index reads undefined), with no array built per call. */
const NO_FABRICS: readonly (Fabric | null)[] = []
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
  // The neck under the jaw: a short run of empty texels between the head's skin above and the neck's below (a neck seen
  // from above, the jaw's underside hiding where it meets the head) is the neck in the jaw's shadow, not a hole, so no
  // outline cuts across the throat. It fills from the neck below, and the jaw's crevice shades it.
  if (skin >= 0)
    for (let x = 0; x < w; x++)
      for (let y = 1; y < h - 1; y++) {
        const k = y * w + x
        if (material[k] >= 0 || part[k - w] !== FACE_SEAM || material[k - w] !== skin) continue
        let e = y
        while (e < h - 1 && e - y < 2 * D && material[e * w + x] < 0) e++
        const q = e * w + x
        if (material[q] !== skin || part[q] === FACE_SEAM) continue
        for (let yy = y; yy < e; yy++) {
          const o = yy * w + x
          material[o] = material[q]
          part[o] = part[q]
          group[o] = group[q]
          depth[o] = depth[q]
          for (let i = 0; i < 3; i++) {
            normal[o * 3 + i] = normal[q * 3 + i]
            place[o * 3 + i] = place[q * 3 + i]
          }
        }
      }
  // Normals smoothed within each part, so a part shades as one form: a round brush, wider at higher density (the face's
  // narrower, so its planes survive: brow, cheekbone, jaw).
  const sm = new Float32Array(n * 3),
    R = Math.round(style.smooth * D)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if (material[k] < 0) continue
      let sx = 0,
        sy = 0,
        sz = 0
      const r = part[k] === FACE_SEAM ? Math.max(1, R - 1) : R
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx,
            yy = y + dy
          if (!filled(xx, yy) || dx * dx + dy * dy > r * r + r) continue
          // Within the part, and across a join into the same region and cloth at nearly the same depth (an elbow, a knee),
          // so the light runs on through it: a smooth union for the shading.
          const q = yy * w + xx
          if (
            part[q] !== part[k] &&
            !(
              group[q] === group[k] &&
              material[q] === material[k] &&
              Math.abs(depth[q] - depth[k]) < style.blend
            )
          )
            continue
          sx += normal[q * 3]
          sy += normal[q * 3 + 1]
          sz += normal[q * 3 + 2]
        }
      if (sz < 0) {
        sx = -sx
        sy = -sy
        sz = -sz
      }
      const l = Math.hypot(sx, sy, sz) || 1
      sm[k * 3] = sx / l
      sm[k * 3 + 1] = sy / l
      sm[k * 3 + 2] = sz / l
    }
  // The face on its planes (facePlane): each texel of its skin found on the head's form through the head's frame, its
  // normal turned to its plane, back into view axes (the normal map carries the planes too).
  const isFace = (k: number) => skin >= 0 && part[k] === FACE_SEAM && material[k] === skin
  // The face is lit in the head's own space, as a sprite's face is: by the key turned toward the face's front (HK), so
  // whichever way it turns, its front planes (forehead, brow, bridge, cheekbone, chin) take the light and the side of
  // the head sits a step down; `facePlaneOf`, the front plane each texel is on (LIGHT).
  const facePlaneOf = new Int8Array(n),
    faceKeyed = new Float32Array(n)
  if (face?.frame) {
    const {
        o,
        ppm: fp,
        R,
        head: [hw, H],
      } = face.frame,
      F = face.shape
    const kh = [0, 1, 2].map(
      (i) => R[i * 3] * FACE_KEY[0] + R[i * 3 + 1] * FACE_KEY[1] + R[i * 3 + 2] * FACE_KEY[2],
    )
    const hk = [0.5 * kh[0], 0.5 * kh[1] + 0.1, 0.5 * kh[2] + 0.75],
      hl = Math.hypot(...hk),
      HK = hk.map((c) => c / hl)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if (!isFace(k)) continue
        const v = [(x + 0.5 - o[0]) / fp, (o[1] - y - 0.5) / fp, depth[k] - o[2]],
          s = [sm[k * 3], sm[k * 3 + 1], sm[k * 3 + 2]]
        const hp = [0, 1, 2].map((i) => R[i * 3] * v[0] + R[i * 3 + 1] * v[1] + R[i * 3 + 2] * v[2])
        const hn = [0, 1, 2].map((i) => R[i * 3] * s[0] + R[i * 3 + 1] * s[1] + R[i * 3 + 2] * s[2])
        // The light on the facets mostly (so the cheekbone's top takes it as the brow's does), the normal map's on the
        // form half, so a turned head still turns as a whole.
        const pl = facePlane(F, hw, H, hp),
          kl = onForm(pl, hn, 0.8),
          pn = onForm(pl, hn, 0.5)
        facePlaneOf[k] = pl[3]
        faceKeyed[k] = kl[0] * HK[0] + kl[1] * HK[1] + kl[2] * HK[2]
        for (let c = 0; c < 3; c++) sm[k * 3 + c] = R[c] * pn[0] + R[3 + c] * pn[1] + R[6 + c] * pn[2]
      }
  }
  // A face models in every view: its thresholds are the style's for faces, held to its tone budget (`model`), so turned
  // from the key it still has a light and a shadow side, and turned to it is never all light.
  // The face is lit as a sprite's is: by the key turned part way to the camera (FACE_KEY), so its shadow side is the side
  // turned from both, and a three-quarter face keeps its front in the mid tone rather than splitting at the nose.
  const framed = !!face?.frame
  const lightOf = (k: number) =>
    isFace(k)
      ? framed
        ? faceKeyed[k]
        : sm[k * 3] * FACE_KEY[0] + sm[k * 3 + 1] * FACE_KEY[1] + sm[k * 3 + 2] * FACE_KEY[2]
      : sm[k * 3] * KEY[0] + sm[k * 3 + 1] * KEY[1] + sm[k * 3 + 2] * KEY[2]
  // The face's light blocked in as a pixel artist blocks it: the key on its planes averaged over a texel round from
  // twice the brand kit's density (within the face), so the light lands in shapes (the forehead's, the cheekbone's) and its tones change in clean edges.
  const faceLit = new Float32Array(n)
  if (skin >= 0)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if (!isFace(k)) continue
        let s = 0,
          c = 0
        for (let dy = 1 - D; dy < D; dy++)
          for (let dx = 1 - D; dx < D; dx++) {
            const xx = x + dx,
              yy = y + dy,
              q = yy * w + xx
            if (
              dx * dx + dy * dy > (D - 1) ** 2 + D - 1 ||
              xx < 0 ||
              yy < 0 ||
              xx >= w ||
              yy >= h ||
              !isFace(q)
            )
              continue
            const wt = dx || dy ? 1 : 2
            s += lightOf(q) * wt
            c += wt
          }
        faceLit[k] = s / c
      }
  let faceTh: [number, number, number] | null = null
  const faceLight = new Uint8Array(n)
  if (skin >= 0) {
    const fs: number[] = []
    for (let k = 0; k < n; k++) if (isFace(k)) fs.push(faceLit[k])
    if (fs.length > 8) {
      fs.sort((a, b) => a - b)
      const th = style.face,
        at = (p: number) => fs[Math.min(fs.length - 1, Math.floor(fs.length * p))]
      const [l0, l1, s0, s1] = style.model
      const t0 = Math.max(at(1 - l1), Math.min(th[0], at(1 - l0)))
      faceTh = [
        framed ? Infinity : t0,
        Math.min(t0 - 0.02, Math.max(at(s0), Math.min(th[1], at(s1)))),
        FACE_DEEP ? Math.min(th[2], at(FACE_DEEP)) : -Infinity,
      ]
      // On a framed face the light tone goes plane by plane (LIGHT): each front plane's brightest share, where it lies
      // in the face's own brightest `2·l1` (so a plane turned from the key, the far cheekbone, stays mid).
      if (framed) {
        const by = LIGHT.map(() => [] as number[]),
          floor = at(1 - 2 * l1)
        for (let k = 0; k < n; k++) if (isFace(k) && facePlaneOf[k]) by[facePlaneOf[k]].push(faceLit[k])
        const planeTh = by.map((v, i) => {
          v.sort((a, b) => a - b)
          return v.length && LIGHT[i]
            ? Math.max(floor, v[Math.min(v.length - 1, Math.floor(v.length * (1 - LIGHT[i])))] - 1e-6)
            : Infinity
        })
        for (let k = 0; k < n; k++)
          if (isFace(k) && facePlaneOf[k] && faceLit[k] >= planeTh[facePlaneOf[k]]) faceLight[k] = 1
      }
    }
  }
  // The key light on each texel, on its smoothed normal. Hair in clumps along its strands, as the atlas paints it: noise
  // stretched down the hair, fixed to its surface; cloth's fine folds, the same noise (the Nurse's uniform hangs in
  // them). Cloth hangs in folds, not pipes: a noise on its own surface, long down it and on a slant, moves the terminator
  // a texel or two along a sleeve or a leg, so its tone bands run out in tapering wedges and change width as cloth's do
  // (skin and hair keep their form; small parts barely change).
  const lit = new Float32Array(n),
    grains = new Float32Array(n),
    P = place
  // A bare limb (skin on an arm or a leg) is modelled along its bone, not only round it: its light pools a third of the
  // way down each part (the deltoid, the forearm's swell, a hand's knuckles) and falls off to the next joint (the wrist,
  // the fingertips), so a forearm is a form that swells and narrows, not a ribbon of two stripes. `s` runs 0→1 down the
  // part's rest length (limbs hang at rest). A dark ramp's sleeve or leg too: black shows its form by its light alone,
  // so that light wraps round each part and turns away at the joint (the elbow, the knee), its terminator crossing the
  // limb there rather than running down it in three columns.
  const limbSpan = new Map<number, [number, number]>()
  const alongBone = (mi: number) => skinny[mi] || darkRamp[mi]
  for (let k = 0; k < n; k++)
    if (material[k] >= 0 && alongBone(material[k]) && (isArm(group[k]) || isLeg(group[k]))) {
      const y = P[k * 3 + 1],
        r = limbSpan.get(part[k])
      if (r) {
        r[0] = Math.min(r[0], y)
        r[1] = Math.max(r[1], y)
      } else limbSpan.set(part[k], [y, y])
    }
  /** How far down its bone a limb's texel lies, 0 at the joint over it to 1 at the next: by the limb's joints (`bends`)
   * where its part lies between them (a sleeve from the shoulder to the wrist turns at the elbow), else down its part. */
  const downBone = (k: number, span: [number, number]) => {
    const j = bends[group[k]],
      y = P[k * 3 + 1]
    if (j && span[0] >= j[j.length - 1] - 0.02 && span[1] <= j[0] + 0.15)
      for (let i = 0; i < j.length - 1; i++)
        if (y >= j[i + 1] || i === j.length - 2)
          return Math.max(0, Math.min(1, (j[i] - y) / (j[i] - j[i + 1])))
    return (span[1] - y) / (span[1] - span[0])
  }
  for (let k = 0; k < n; k++) {
    const mi = material[k]
    if (mi < 0) continue
    const m = materials[mi],
      q3 = k * 3,
      streaks = m.strands ? style.strands : (m.streaks ?? 0)
    let f = isFace(k) ? faceLit[k] : lightOf(k)
    if (streaks) {
      grains[k] = (noise3(P[q3] * 34, P[q3 + 1] * 9, P[q3 + 2] * 34) - 0.5) * streaks
      f += grains[k]
    }
    const span = alongBone(mi) ? limbSpan.get(part[k]) : undefined
    if (span && span[1] - span[0] > 0.01)
      f += (skinny[mi] ? 0.14 : 0.3) * Math.cos(Math.PI * (downBone(k, span) - 0.3))
    if (style.folds && mi !== skin && !m.strands && part[k] !== FACE_SEAM)
      f +=
        (darkRamp[mi] ? 0.5 : 1) *
        (noise3((P[q3] + P[q3 + 1] * 0.6) * 12, P[q3 + 1] * 2.5, (P[q3 + 2] - P[q3 + 1] * 0.4) * 12) - 0.5) *
        style.folds
    lit[k] = f
  }
  /** A surface the painter models as a whole: a garment's or the body's part, in one material (not the face, the hair,
   * a mark or a flat material). */
  const modelled = (k: number) =>
    material[k] >= 0 &&
    part[k] >= 0 &&
    part[k] !== FACE_SEAM &&
    !hairy(part[k]) &&
    !materials[material[k]].flat &&
    !materials[material[k]].strands
  const surfaceOf = (k: number) => part[k] * 4096 + material[k]
  // Large surfaces model whichever way they turn, as the face does: a garment or a limb of `surface[2]` texels or more
  // (times the density squared) keeps at least `surface[0]` of itself in shadow, its terminator the form's own (its
  // least-lit texels), and at most `surface[1]` in its light tone; so a hoodie turned to the key is never two light tones
  // with no form, and a forearm's light sits on the planes that face the key, not down its length.
  const surfTh = new Map<number, [number, number, number]>()
  {
    const by = new Map<number, number[]>()
    for (let k = 0; k < n; k++)
      if (modelled(k)) {
        const key = surfaceOf(k)
        let a = by.get(key)
        if (!a) {
          a = []
          by.set(key, a)
        }
        a.push(lit[k])
      }
    for (const [key, fs] of by) {
      // A bare limb's part models whatever its size, so a thin forearm still has its light, mid and shadow.
      if (fs.length < style.surface[2] * D * D && !limbSpan.has(Math.floor(key / 4096))) continue
      fs.sort((a, b) => a - b)
      const th = materials[key % 4096].tones ?? style.tones,
        at = (p: number) => fs[Math.min(fs.length - 1, Math.floor(fs.length * p))]
      // A dark ramp's light is a plane of its own, a quarter of it on the side that faces the key (black has three
      // values, and its light is the one that shows its form), its shadow the far third.
      const dk = darkRamp[key % 4096],
        t1 = Math.max(th[1], at(dk ? 0.3 : style.surface[0])),
        t0 = dk ? Math.max(t1 + 0.02, at(0.75)) : Math.max(th[0], at(1 - style.surface[1]), t1 + 0.02)
      surfTh.set(key, [t0, t1, Math.min(th[2], t1 - 0.02)])
    }
  }
  const thOf = (k: number): readonly number[] =>
    faceTh && material[k] === skin && part[k] === FACE_SEAM
      ? faceTh
      : (surfTh.get(surfaceOf(k)) ?? materials[material[k]].tones ?? style.tones)
  // Quilting: a sewn chamber (a surface beside another of its group in the same ramp under another name, as garments.ts
  // `chambers` makes a puffer's baffles, and long across its run) is lit as one pillow by its rows across the band: its
  // first rows on the key's side the crest (light where the band faces the key, mid away from it), its body mid or
  // shadow by the band's own light, its last row before the stitch deep. Each baffle then reads as one clean roll over a
  // shadow, varying only in width with the light, never as islands of light where the bumps catch it.
  const band = new Int8Array(n).fill(-9)
  {
    const by = new Map<number, number[]>()
    for (let k = 0; k < n; k++)
      if (modelled(k)) {
        let a = by.get(part[k])
        if (!a) {
          a = []
          by.set(part[k], a)
        }
        a.push(k)
      }
    for (const [p, ks] of by) {
      if (ks.length < 4 * D * D) continue
      let stitched = 0,
        mx = 0,
        my = 0
      for (const k of ks) {
        const x = k % w,
          y = (k - x) / w
        mx += x
        my += y
        for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w])
          if (
            q >= 0 &&
            q < n &&
            part[q] !== p &&
            modelled(q) &&
            group[q] === group[k] &&
            material[q] !== material[k] &&
            tones[material[q]] === tones[material[k]]
          )
            stitched++
      }
      if (stitched < 2 * D) continue
      mx /= ks.length
      my /= ks.length
      let sxx = 0,
        syy = 0,
        sxy = 0
      for (const k of ks) {
        const x = (k % w) - mx,
          y = (k - (k % w)) / w - my
        sxx += x * x
        syy += y * y
        sxy += x * y
      }
      // The band's run is its long axis; across it (the short one) its rows go from the stitch on the key's side to the next.
      const tr = (sxx + syy) / 2,
        det = Math.sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy * sxy)),
        lo = tr - det,
        hi = tr + det
      if (hi < lo * 3.2) continue
      let ux = sxy,
        uy = lo - sxx
      if (Math.abs(ux) + Math.abs(uy) < 1e-9) {
        ux = sxx <= syy ? 1 : 0
        uy = sxx <= syy ? 0 : 1
      }
      const ul = Math.hypot(ux, uy)
      ux /= ul
      uy /= ul
      if (Math.abs(ux) > 0.92) {
        ux = Math.sign(ux)
        uy = 0
      } else if (Math.abs(uy) > 0.92) {
        ux = 0
        uy = Math.sign(uy)
      }
      if (ux * K2[0] + uy * K2[1] > 0) {
        ux = -ux
        uy = -uy
      }
      const th = thOf(ks[0]),
        gloss = materials[material[ks[0]]].gloss !== undefined
      for (const k of ks) {
        const x = k % w,
          y = (k - x) / w
        let a = 0,
          b = 0,
          sum = lit[k],
          c = 1
        const at = (i: number) => {
          const xx = Math.round(x + ux * i),
            yy = Math.round(y + uy * i)
          return xx >= 0 && yy >= 0 && xx < w && yy < h && part[yy * w + xx] === p ? yy * w + xx : -1
        }
        for (let q = at(-1); q >= 0 && a < 12 * D; q = at(-(++a + 1))) {
          sum += lit[q]
          c++
        }
        for (let q = at(1); q >= 0 && b < 12 * D; q = at(++b + 1)) {
          sum += lit[q]
          c++
        }
        const fb = sum / c,
          rows = a + b + 1
        // A glossy chamber's crest catches the key as one line of shine along its top, where the band faces it.
        band[k] =
          a < D && rows > D
            ? fb > th[0] && a === 0 && gloss
              ? -1
              : fb > th[1]
                ? 0
                : 1
            : b === 0 && rows >= 3
              ? D > 1 && rows >= 4
                ? 3
                : 2
              : fb > th[2]
                ? 1
                : 2
      }
    }
  }
  /** A dark, hard gloss (leather, patent, a black frame): its body stays dark, its light only a thin rim on the key's side
   * of its silhouette, its highlight one soft patch per surface (the sheen, above), not a streak along every crest. */
  const hard = materials.map(
    (m, i) => m.gloss !== undefined && !m.strands && i !== skin && oklab(tones[i][1])[0] < 0.4,
  )
  // Tones: 0 light … 3 deep, −1 a gloss's shine, −2 empty, OUTLINE and LINE. `owner` is the shape an outline texel
  // belongs to (the nearer one): its line tone and its normal.
  const tone = new Int8Array(n).fill(-2),
    owner = new Int32Array(n).fill(-1),
    under = new Int8Array(n).fill(2)
  const half = (() => {
    const v = [KEY[0], KEY[1], KEY[2] + 1],
      l = Math.hypot(...v)
    return v.map((c) => c / l)
  })()
  const spec = (k: number) => sm[k * 3] * half[0] + sm[k * 3 + 1] * half[1] + sm[k * 3 + 2] * half[2]
  // A glossy face's sheen: a few texels on the planes that mirror the key best (its top 4%, at most 3·D of them), never
  // a whole plane (its planes are flat, so a sheen by threshold would take one entire).
  let faceSheen = Infinity
  if (skin >= 0 && materials[skin].gloss !== undefined) {
    const ss: number[] = []
    for (let k = 0; k < n; k++) if (isFace(k)) ss.push(spec(k))
    ss.sort((a, b) => b - a)
    if (ss.length) faceSheen = ss[Math.min(ss.length - 1, Math.floor(Math.min(0.04 * ss.length, 3 * D)))]
  }
  // A dark gloss's sheen patch, per surface (a part in one material): the texels that mirror the key best, by the mirror term
  // (the texel's index breaks a tie, so a flat surface never takes whole). Marked here, before the tone loop reads it.
  const sheen = new Uint8Array(n)
  if (hard.some(Boolean)) {
    const bySurface = new Map<number, number[]>()
    for (let k = 0; k < n; k++)
      if (material[k] >= 0 && part[k] >= 0 && hard[material[k]]) {
        const key = surfaceOf(k)
        let a = bySurface.get(key)
        if (!a) {
          a = []
          bySurface.set(key, a)
        }
        a.push(k)
      }
    for (const [key, ks] of bySurface) {
      if (ks.length < SHEEN_MIN * D * D) continue
      const take = Math.min(
        Math.floor(GLOSS_SHEEN * materials[key % 4096].gloss! * ks.length * sheenScale(D)),
        Math.ceil(SHEEN_MAX * D * D * sheenScale(D)),
      )
      ks.sort((a, b) => spec(b) - spec(a) || a - b)
      for (let i = 0; i < Math.max(1, take); i++) sheen[ks[i]] = 1
    }
  }
  const maxShadow = Math.round(style.shadow * D)
  /** Within `D` rows under the face's skin: the jaw's own shadow band on the neck. */
  const underJaw = (x: number, y: number) => {
    for (let d = 1; d <= D; d++) if (y - d >= 0 && part[(y - d) * w + x] === FACE_SEAM) return true
    return false
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x,
        mi = material[k]
      if (mi < 0) continue
      const m = materials[mi]
      // Where another group passes in front: this, the far side, takes its outline; a nearer part beside: a crevice tone.
      let line = -1,
        crevice = false
      for (let i = 0; i < 4; i++) {
        const xx = x + (i === 0 ? -1 : i === 1 ? 1 : 0),
          yy = y + (i === 2 ? -1 : i === 3 ? 1 : 0)
        if (!filled(xx, yy)) continue
        const q = yy * w + xx
        if (part[q] === part[k] || (part[q] < 0 && part[q] !== -2)) continue
        const d = depth[q] - depth[k]
        // One garment over the trunk and the legs (trousers' seat and legs, in one cloth whatever its wash) is one
        // surface: no line where it crosses.
        const cloth =
          material[q] >= 0 &&
          tones[material[q]] === tones[mi] &&
          (isLeg(group[k]) ? group[q] === GROUP.torso : group[k] === GROUP.torso && isLeg(group[q]))
        if (group[q] !== group[k] && d > style.line && !cloth) {
          if (line < 0 || depth[q] > depth[line]) line = q
        }
        // Where two body regions only touch (an arm hanging against the ribs, the thighs, a hand on the leg), their
        // depths meet: the line runs down the contact, on whichever side sits behind, beside the other's flank (not over
        // a shoulder's or a hip's top, where one grows from the other).
        else if (
          i < 2 &&
          touching(group[k], group[q]) &&
          (d > 0 || (d === 0 && group[k] < group[q])) &&
          Math.abs(sm[k * 3 + 1]) < 0.35 &&
          Math.abs(sm[q * 3 + 1]) < 0.35
        ) {
          if (line < 0) line = q
        } else if (
          d > style.crevice &&
          !(band[k] > -9 && group[q] === group[k] && material[q] >= 0 && tones[material[q]] === tones[mi])
        )
          crevice = true
      }
      if (m.flat || part[k] === -2) {
        if (line >= 0 && part[k] !== -2) {
          tone[k] = OUTLINE
          owner[k] = line
          under[k] = 1
        } else tone[k] = 1
        continue
      }
      const f = lit[k],
        grain = grains[k],
        th = thOf(k)
      let t = band[k] > -9 ? band[k] : f > th[0] ? 0 : f > th[1] ? 1 : f > th[2] ? 2 : 3
      if (t === 1 && faceLight[k]) t = 0
      if (m.lift !== undefined && m.lift <= 0) t = Math.max(t, 1)
      // A chamber's stitch is its own last row: the next chamber beside it casts no crevice and no shadow on it.
      const quilted = band[k] > -9,
        stitch = (q: number) =>
          quilted && group[q] === group[k] && material[q] >= 0 && tones[material[q]] === tones[mi]
      if (crevice) t = Math.max(t, 2)
      // The cast shadow: march toward the key; a part of another surface standing above the ray's climb shades this one.
      // The head shades the neck in one band, `D` rows under the jaw's edge, never stacked deeper (a crevice and a cast
      // shadow piled under a short chin read as a beard).
      const neck = mi === skin && part[k] !== FACE_SEAM && group[k] === GROUP.head
      // The neck is the head's to shade: it sits under the jaw, never in the face's light.
      if (neck) t = Math.max(t, 1)
      for (let d = 1; d <= maxShadow; d++) {
        const xx = Math.round(x + K2[0] * d),
          yy = Math.round(y + K2[1] * d)
        if (!filled(xx, yy)) continue
        const q = yy * w + xx
        if (part[q] === part[k] || part[q] === -2) continue
        if ((neck && part[q] === FACE_SEAM && !underJaw(x, y)) || stitch(q)) continue
        if (depth[q] - depth[k] > style.shadowDepth + (RISE * d) / ppm) {
          t = Math.max(t, 2)
          break
        }
      }
      // A gloss mirrors the key where the surface faces halfway between it and the eye (the strands break it on hair): a
      // tight spot, tighter the glossier. A hard one: its shine only in the surface's sheen patch (above), where it mirrors the
      // key best, so a sleeve's is one soft highlight that holds its place from frame to frame.
      if (m.gloss !== undefined && t <= 1 && band[k] === -9) {
        const sk = spec(k)
        if (hard[mi]) {
          if (sheen[k] && sk > 1 - (1 - m.gloss) * 0.9) t = -1
        } else if (isFace(k) ? t === 0 && sk > faceSheen : sk + grain * 0.15 > 1 - (1 - m.gloss) * 0.6) t = -1
      }
      // An ear (a surface in the skin's own tones but not the skin): the skin's ramp, its rim the mid or the shadow (never
      // the light, nor a gloss's shine: the face's front is where the light lands) and its bowl the one shadow step inside
      // it, so at sprite size it reads as an ear, not a dark or a pale patch.
      if (skinny[mi] && mi !== skin && t !== OUTLINE) t = Math.max(1, Math.min(t, 2))
      // A line texel keeps the tone it would have had (`under`), should its line turn out a stray fleck.
      if (line >= 0) {
        tone[k] = OUTLINE
        owner[k] = line
        under[k] = Math.max(t, 2)
      } else tone[k] = handTone[k] >= 0 ? handTone[k] : t
    }
  // A dark gloss's sheen keeps no speck: a patch that a shadow or the surface's edge cut down to a few texels is dropped (the
  // surface reads in its mid tone there), as a sprite artist would not leave an orphan highlight. A quilted chamber's crest
  // (`band`) is a line, not a patch: it stays whatever its length.
  if (hard.some(Boolean)) {
    const seen = new Uint8Array(n),
      least = Math.ceil((SHEEN_MIN * D * D * sheenScale(D)) / 4)
    for (let k = 0; k < n; k++) {
      if (tone[k] !== -1 || seen[k] || !hard[material[k]] || band[k] > -9) continue
      const area = [k]
      seen[k] = 1
      for (let i = 0; i < area.length; i++)
        for (const q of [area[i] - 1, area[i] + 1, area[i] - w, area[i] + w]) {
          if (
            q >= 0 &&
            q < n &&
            !seen[q] &&
            tone[q] === -1 &&
            band[q] === -9 &&
            surfaceOf(q) === surfaceOf(k)
          ) {
            seen[q] = 1
            area.push(q)
          }
        }
      if (area.length < least) for (const q of area) tone[q] = 1
    }
  }
  // The hair's sheen band, as a sprite artist paints glossy hair: a ring of the hair's shine round the crown where its
  // surface turns from the top to the side (its normal's rise in a narrow window), broken where the strands part it, on
  // the key's side brighter (its shine) and on the far side its light; never on locks hanging down (a tail, a fringe's
  // fall), which do not rise. Glossy hair alone (a straight or sleek finish, or strands): coils, braids and locs are matte.
  for (let k = 0; k < n; k++) {
    const mi = material[k]
    if (
      mi < 0 ||
      !hairy(part[k]) ||
      !(materials[mi].sheen || materials[mi].strands) ||
      tone[k] < 0 ||
      tone[k] > 2
    )
      continue
    const nx = sm[k * 3],
      ny = sm[k * 3 + 1],
      nz = sm[k * 3 + 2]
    if (nz < 0.05 || ny < SHEEN[0]) continue
    // Over the band the crown sits a tone down, in the mid, so the ring reads as a ring and not as the top lit whole.
    if (ny > SHEEN[1]) {
      tone[k] = Math.max(tone[k], 1)
      continue
    }
    if (grains[k] < -0.18) continue
    tone[k] = nx * K2[0] >= -0.2 ? -1 : 0
  }
  // The face's tones as a pixel artist cleans them: a texel standing out of its plane (five of its eight neighbours one
  // other tone: a spur, a fleck, a notch in an edge) takes that tone, so its planes meet in clean edges and its shapes
  // keep their size (the drawn face puts its own marks on after). A front plane's light (LIGHT) is a shape drawn on
  // purpose, the bridge's a line: it stays.
  for (let pass = 0; pass < 2; pass++) {
    const was = tone.slice()
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const k = y * w + x
        if (!isFace(k) || was[k] < 0 || was[k] > 3 || (was[k] === 0 && faceLight[k])) continue
        const count = [0, 0, 0, 0]
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const q = k + dy * w + dx
            if ((dx || dy) && isFace(q) && was[q] >= 0 && was[q] <= 3) count[was[q]]++
          }
        let best = was[k]
        for (let i = 0; i < 4; i++) if (count[i] > count[best]) best = i
        if (best !== was[k] && count[best] >= 5 && count[was[k]] <= 2) tone[k] = best
      }
  }
  // Lines run whole: a gap of a texel or two along a line inside the figure (where the contact flickers along a flank)
  // closes, between line texels on one surface drawn for one nearer part, so no line breaks into dashes.
  const lineOn = (q: number, k: number) =>
    q >= 0 && q < n && tone[q] === OUTLINE && material[q] >= 0 && part[q] === part[k]
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const k = y * w + x
      if (material[k] < 0 || tone[k] === OUTLINE || tone[k] === -2) continue
      for (const d of [1, w, w + 1, w - 1]) {
        // The line's ends either side, one of them next to this texel.
        const a = lineOn(k - d, k) ? k - d : lineOn(k - 2 * d, k) ? k - 2 * d : -1,
          b = lineOn(k + d, k) ? k + d : lineOn(k + 2 * d, k) ? k + 2 * d : -1
        if (a < 0 || b < 0 || (a !== k - d && b !== k + d) || part[owner[a]] !== part[owner[b]]) continue
        under[k] = Math.max(tone[k], 2)
        tone[k] = OUTLINE
        owner[k] = owner[a]
        break
      }
    }
  // Stray flecks of line: an interior line still of fewer than a few texels (8-connected, not running into the outline
  // outside) is where two forms only graze; it goes back to its shadow tone whole.
  const minLine = 2 + D,
    lineSeen = new Uint8Array(n),
    lineRun: number[] = [],
    stack: number[] = []
  for (let s0 = 0; s0 < n; s0++) {
    if (lineSeen[s0] || tone[s0] !== OUTLINE || material[s0] < 0) continue
    lineRun.length = 0
    stack.push(s0)
    lineSeen[s0] = 1
    let outside = false
    while (stack.length) {
      const k = stack.pop()!
      lineRun.push(k)
      const x = k % w,
        y = (k - x) / w
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy
          if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          const q = yy * w + xx
          if (material[q] < 0) {
            outside = true
            continue
          }
          if (tone[q] === OUTLINE && !lineSeen[q]) {
            lineSeen[q] = 1
            stack.push(q)
          }
        }
    }
    if (!outside && lineRun.length < minLine)
      for (const k of lineRun) {
        tone[k] = under[k]
        owner[k] = -1
      }
  }
  // Reflected light: a deep texel on the shadow side's edge (beside the outside, or the line on a far part, away from
  // the key) lifts to shadow, so the form turns before its line and the two darks never double.
  const edgeAt = (x: number, y: number) => !filled(x, y) || tone[y * w + x] === OUTLINE
  if (style.bounce)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if (tone[k] !== 3) continue
        const away = edgeAt(x + 1, y) || edgeAt(x, y + 1),
          toward = edgeAt(x - 1, y) || edgeAt(x, y - 1)
        if (away && !toward && (tone[k - 1] === 3 || tone[k - w] === 3)) tone[k] = 2
      }
  // The clusters, as a pixel artist cleans them: a run of one tone in one part smaller than the cluster size takes the
  // tone its edge touches most (a shine keeps any run of two, a face's plane its light from a run of D, at least two).
  const minSize = style.cluster * D * D,
    seen = new Uint8Array(n),
    run: number[] = [],
    votes = new Int32Array(16)
  const shineCap = Math.ceil(SHEEN_MAX * D * D * sheenScale(D)),
    shineOf = new Map<number, number>()
  for (let k = 0; k < n; k++)
    if (tone[k] === -1 && material[k] >= 0 && hard[material[k]]) {
      const key = surfaceOf(k)
      shineOf.set(key, (shineOf.get(key) ?? 0) + 1)
    }
  for (let s0 = 0; s0 < n; s0++) {
    const t0 = tone[s0]
    if (
      seen[s0] ||
      t0 < -1 ||
      t0 >= OUTLINE ||
      part[s0] === -2 ||
      materials[material[s0]].flat ||
      handTone[s0] >= 0
    )
      continue
    run.length = 0
    stack.push(s0)
    seen[s0] = 1
    votes.fill(0)
    while (stack.length) {
      const k = stack.pop()!
      run.push(k)
      const x = k % w,
        y = (k - x) / w
      for (let i = 0; i < 4; i++) {
        const q =
          i === 0
            ? x > 0
              ? k - 1
              : -1
            : i === 1
              ? x < w - 1
                ? k + 1
                : -1
              : i === 2
                ? y > 0
                  ? k - w
                  : -1
                : y < h - 1
                  ? k + w
                  : -1
        if (q < 0 || material[q] !== material[s0] || part[q] !== part[s0]) continue
        if (tone[q] === t0 && handTone[q] < 0) {
          if (!seen[q]) {
            seen[q] = 1
            stack.push(q)
          }
        } else if (tone[q] >= -1 && tone[q] < OUTLINE) votes[tone[q] + 1]++
      }
    }
    if (
      run.length >= (t0 === -1 ? Math.min(2, minSize) : t0 === 0 && faceLight[s0] ? Math.max(2, D) : minSize)
    )
      continue
    let best = t0,
      most = 0
    // (A dark gloss's shine stays within its patch's cap: a fleck beside the patch joins it only while the surface is under.)
    const gain = hard[material[s0]] && t0 !== -1 ? (shineOf.get(surfaceOf(s0)) ?? 0) : -Infinity
    for (let i = 0; i < 5; i++)
      if (votes[i] > most && (i > 0 || gain + run.length <= shineCap)) {
        most = votes[i]
        best = i - 1
      }
    if (best !== t0) {
      for (const k of run) tone[k] = best
      if (hard[material[s0]]) {
        const key = surfaceOf(s0)
        shineOf.set(
          key,
          (shineOf.get(key) ?? 0) + (best === -1 ? run.length : 0) - (t0 === -1 ? run.length : 0),
        )
      }
    }
  }
  // The detail floor: a fleck of a part's material too small to read as a thing (under 2·D² texels: a heel tab's tip
  // under a hem, a strap's end) in the middle of another's (three quarters of what it touches) is that one's; a mark
  // shorter than D + 1 texels (a woven tag's corner) with no shine of its own goes too. The head's (a stud, a tie) and
  // the skin's keep theirs: an accent there is the face's.
  {
    const islandSeen = new Uint8Array(n),
      around = new Map<number, number>()
    for (let s0 = 0; s0 < n; s0++) {
      const m0 = material[s0]
      if (
        islandSeen[s0] ||
        m0 < 0 ||
        m0 === skin ||
        handTone[s0] >= 0 ||
        group[s0] === GROUP.head ||
        hairy(part[s0]) ||
        part[s0] === FACE_SEAM
      )
        continue
      const mark = part[s0] === -2
      run.length = 0
      stack.push(s0)
      islandSeen[s0] = 1
      around.clear()
      while (stack.length) {
        const k = stack.pop()!
        run.push(k)
        const x = k % w,
          y = (k - x) / w
        for (const q of [
          x > 0 ? k - 1 : -1,
          x < w - 1 ? k + 1 : -1,
          y > 0 ? k - w : -1,
          y < h - 1 ? k + w : -1,
        ]) {
          if (q < 0 || material[q] < 0) continue
          // A part's fleck is one material; a mark's, every mark it touches (a chain's links alternate their metals).
          if (mark ? part[q] === -2 : material[q] === m0 && part[q] !== -2) {
            if (!islandSeen[q]) {
              islandSeen[q] = 1
              stack.push(q)
            }
          } else around.set(q, material[q])
        }
      }
      if (
        run.length >= (mark ? D + 1 : 2 * D * D) ||
        (mark && run.some((k) => materials[material[k]].gloss !== undefined))
      )
        continue
      const votes = new Map<number, number>()
      for (const mq of around.values()) votes.set(mq, (votes.get(mq) ?? 0) + 1)
      let best = -1,
        most = 0
      for (const [mq, c] of votes)
        if (c > most) {
          most = c
          best = mq
        }
      if (best < 0 || (!mark && most < 0.75 * around.size)) continue
      const host = [...around].find(([, mq]) => mq === best)![0]
      for (const k of run) {
        material[k] = best
        part[k] = part[host]
        group[k] = group[host]
        if (tone[k] !== OUTLINE) tone[k] = tone[host] === OUTLINE ? under[host] : tone[host]
      }
    }
  }
  // The outline outside the figure: each empty texel beside it, owned by its nearest filled neighbour.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if (material[k] >= 0) continue
      let best = -1
      for (let i = 0; i < 4; i++) {
        const xx = x + (i === 0 ? -1 : i === 1 ? 1 : 0),
          yy = y + (i === 2 ? -1 : i === 3 ? 1 : 0)
        if (filled(xx, yy) && (best < 0 || depth[yy * w + xx] > depth[best])) best = yy * w + xx
      }
      if (best >= 0) {
        tone[k] = OUTLINE
        owner[k] = best
      }
    }
  // Selective, on the silhouette: an outline texel on the key's side of its shape (the shape lies away from the key)
  // takes the shape's line. A pixel artist decides it per run of the contour, not per texel, or a diagonal beads into
  // ink at every stair: the shape's direction is taken over a wide window (its centroid from the texel, so a stair's
  // corner and its tread agree), averaged along the contour, and a run shorter than `2D + 1` takes its neighbours'.
  if (style.selout) {
    const score = new Float32Array(n).fill(NaN),
      W = D + 1,
      minRun = 2 * D + 1
    const outlined = (q: number) => tone[q] === OUTLINE || tone[q] === LINE
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if (tone[k] !== OUTLINE || material[k] >= 0) continue
        const ownPart = part[owner[k]]
        let gx = 0,
          gy = 0
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx,
              yy = y + dy,
              q = yy * w + xx
            if (
              (dx || dy) &&
              xx >= 0 &&
              yy >= 0 &&
              xx < w &&
              yy < h &&
              material[q] >= 0 &&
              part[q] === ownPart &&
              tone[q] < OUTLINE
            ) {
              const r2 = dx * dx + dy * dy
              gx += dx / r2
              gy += dy / r2
            }
          }
        const l = Math.hypot(gx, gy)
        score[k] = l > 0 ? -(gx * K2[0] + gy * K2[1]) / l : 0
      }
    // Along the contour: the mean over the outline of the same shape within W.
    const along = new Float32Array(n).fill(NaN)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if (Number.isNaN(score[k])) continue
        const ownPart = part[owner[k]]
        let s = 0,
          c = 0
        for (let dy = -W; dy <= W; dy++)
          for (let dx = -W; dx <= W; dx++) {
            const xx = x + dx,
              yy = y + dy,
              q = yy * w + xx
            if (
              xx >= 0 &&
              yy >= 0 &&
              xx < w &&
              yy < h &&
              !Number.isNaN(score[q]) &&
              part[owner[q]] === ownPart
            ) {
              s += score[q]
              c++
            }
          }
        along[k] = s / c
        if (along[k] > 0.3) tone[k] = LINE
      }
    // Runs: a short run of line between ink (or of ink between line) along one shape's contour takes the other.
    const runSeen = new Uint8Array(n)
    for (let s0 = 0; s0 < n; s0++) {
      if (runSeen[s0] || Number.isNaN(along[s0])) continue
      const t0 = tone[s0],
        ownPart = part[owner[s0]]
      run.length = 0
      stack.push(s0)
      runSeen[s0] = 1
      let other = false
      while (stack.length) {
        const k = stack.pop()!
        run.push(k)
        const x = k % w,
          y = (k - x) / w
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              yy = y + dy,
              q = yy * w + xx
            if (
              (!dx && !dy) ||
              xx < 0 ||
              yy < 0 ||
              xx >= w ||
              yy >= h ||
              Number.isNaN(along[q]) ||
              part[owner[q]] !== ownPart ||
              !outlined(q)
            )
              continue
            if (tone[q] !== t0) other = true
            else if (!runSeen[q]) {
              runSeen[q] = 1
              stack.push(q)
            }
          }
      }
      // A bare hand's or limb's run is shorter (its lit edge is the skin's line, never ink round a small form).
      if (other && run.length < (skinny[material[owner[s0]]] ? D + 1 : minRun))
        for (const k of run) tone[k] = t0 === LINE ? OUTLINE : LINE
    }
  }
  // Black's form: on a dark ramp the edge inside its lit line is a cool rim (its line alone is as dark as ink), and the
  // texel on the key's side of a fold (ink, a step under its deep) a welt two steps up, so a lapel, a yoke or a sleeve
  // reads as a raised edge over its shadow.
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const k = y * w + x,
        mi = material[k]
      if (mi < 0 || !darkRamp[mi]) continue
      if (tone[k] >= 0 && tone[k] <= 2) {
        for (const q of [k - 1, k + 1, k - w, k + w])
          if (material[q] < 0 && tone[q] === LINE && part[owner[q]] === part[k]) {
            tone[k] = RIM
            break
          }
      } else if (tone[k] === OUTLINE) {
        for (const q of [K2[0] < 0 ? k - 1 : k + 1, K2[1] < 0 ? k - w : k + w])
          if (material[q] >= 0 && darkRamp[material[q]] && tone[q] >= 0 && tone[q] <= 3)
            tone[q] = Math.max(0, tone[q] - 2)
      }
    }
  // A stain on fitted cloth (trousers) is a wash, as denim wears: a soft fade on the thighs' fronts and the knees (never
  // the seat, where it would pillow each cheek), an ellipse centred a little below the stain's start and gone by its
  // end, the wash's ramp at the cloth's own tone (no darker ring at its edge), so it fades and never drips; whiskers,
  // short level strokes a texel thick a texel apart, across the hip crease (slanting down and out from the crotch) and
  // the back of the knee, a tone lighter than the cloth around them. 0 none, 1 the edge, 2 the core, 3 a whisker.
  const centre = new Map<number, number>()
  if (stains.some(Boolean)) {
    const sum = new Map<number, [number, number]>()
    for (let k = 0; k < n; k++)
      if (material[k] >= 0 && stains[material[k]]) {
        const a = sum.get(part[k]) ?? [0, 0]
        a[0] += P[k * 3]
        a[1]++
        sum.set(part[k], a)
      }
    for (const [p, [sx, c]] of sum) centre.set(p, sx / c)
  }
  const wash = (k: number, up: number, stain: NonNullable<Material['stain']>) => {
    const q = k * 3,
      leg = isLeg(group[k]),
      z = P[q + 2],
      run = stain.hem - stain.below
    const facing = smooth(((leg ? z : -z) - 0.015) / 0.05),
      side = group[k] === GROUP.legL ? 1 : -1
    // `along` runs outward from the leg's middle; on the seat, from the middle of either side of it.
    const dx = P[q] - (centre.get(part[k]) ?? P[q]),
      along = leg ? dx * side : Math.abs(dx) - 0.085
    // The fade's oval: longer below its middle than above, narrowing away from the cloth's middle line.
    const v =
      smooth(1 - (up < 0.7 ? (0.7 - up) / 0.4 : (up - 0.7) / 0.75)) * smooth(1 - Math.abs(along) / 0.11)
    if (leg) {
      // Whiskers: their rows across the stroke (one every three texels), each a few texels long where the noise lets it;
      // at the hip from the crotch side of the thigh's front.
      const stroke = (c: number, zone: boolean, salt: number, odds: number) => {
        if (!zone) return false
        const at = (c * ppm) / 3 + 0.5,
          row = Math.floor(at)
        return at - row < 0.34 && noise3(row * 1.7 + salt, (along * ppm) / 7, part[k] * 0.37) > odds
      }
      if (
        stroke(
          P[q + 1] - stain.hem + 0.35 * along,
          up > 0.22 && up < 0.6 && facing > 0.3 && along < 0.03,
          0,
          0.47,
        )
      )
        return 3
      const knee = stain.below - 0.26 * run
      if (stroke(P[q + 1] - knee, Math.abs(P[q + 1] - knee) < 0.04 && smooth(-z / 0.04) > 0.5, 11, 0.56))
        return 3
    }
    const s = v * facing + (noise3(P[q] * 9, P[q + 1] * 6, P[q + 2] * 9) - 0.5) * 0.4
    // The seat only ever half fades: worn, never a spotlight.
    return s > 0.6 && leg ? 2 : s > 0.4 ? 1 : 0
  }
  // Iridescence: a holo surface (a part, or a material's marks together) ranks its texels by their light and their turn
  // across the view, and lays its ramp over them in that order, a quarter each: the most turned to the key and the
  // eye its first (cyan) step, the least its last (violet); its shadow never brighter than its third step.
  const hue = new Int8Array(n).fill(-1),
    through = new Map<number, number[]>()
  if (materials.some((m) => m.holo)) {
    const by = new Map<number, number[]>()
    for (let k = 0; k < n; k++) {
      const mi = material[k]
      if (mi < 0 || !materials[mi].holo || tone[k] < 0 || tone[k] >= OUTLINE) continue
      const key = part[k] >= 0 ? part[k] * 4096 + mi : -1 - mi
      let a = by.get(key)
      if (!a) {
        a = []
        by.set(key, a)
      }
      a.push(k)
    }
    const phase = (k: number) => lit[k] + 0.6 * sm[k * 3] - 0.3 * sm[k * 3 + 1]
    for (const ks of by.values()) {
      ks.sort((a, b) => phase(b) - phase(a))
      if (materials[material[ks[0]]].holo !== 'mirror') {
        ks.forEach((k, i) => {
          hue[k] = Math.max(Math.min(3, Math.floor((i / ks.length) * 4)), tone[k] >= 2 ? 2 : 0)
        })
        continue
      }
      // A mirror: each lens (a connected run of it) is its tint, lit on the key's side of its middle (MIRROR + 0) and
      // dark past it (+ 1); its top row reflects the sky on the key's side alone, its ramp laid along it from the key's
      // end (at most `MIRROR_SKY` of the row and D + 1 texels: an edge, never a visor across it); its glint, a texel of its
      // first step under that edge's key end where the lens has the rows.
      const mine = new Set(ks),
        lensSeen = new Set<number>(),
        toKey = K2[0] < 0 ? -1 : 1
      for (const k0 of ks) {
        if (lensSeen.has(k0)) continue
        const lens: number[] = [k0]
        lensSeen.add(k0)
        for (let i = 0; i < lens.length; i++)
          for (const q of [lens[i] - 1, lens[i] + 1, lens[i] - w, lens[i] + w])
            if (mine.has(q) && !lensSeen.has(q)) {
              lensSeen.add(q)
              lens.push(q)
            }
        const xs = lens.map((k) => k % w),
          mid = (Math.min(...xs) + Math.max(...xs)) / 2
        for (const k of lens) hue[k] = MIRROR + +(((k % w) - mid) * toKey < 0)
        const top = lens.filter((k) => !mine.has(k - w)).sort((a, b) => ((b % w) - (a % w)) * toKey)
        const sky = Math.min(Math.ceil(top.length * MIRROR_SKY), D + 1)
        top.slice(0, sky).forEach((k, i) => {
          hue[k] = Math.min(3, Math.floor((i / sky) * 3))
        })
        const glint = top[0] + w
        if (top.length && mine.has(glint) && lens.length >= 6 * D) hue[glint] = 0
      }
    }
  }
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
