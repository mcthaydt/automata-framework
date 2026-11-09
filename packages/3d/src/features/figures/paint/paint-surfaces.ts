import { cos } from '@automata/sim/math'
import { oklab } from '../../../shared/math/colour.ts'
import { noise3 } from '../../../shared/math/noise.ts'
import { duel, hex, INK_RGB, tonesOf } from './duel-snap.ts'
import { fabricOf } from './fabric.ts'
import { FACE_DEEP, FACE_SEAM, facePlane, HAIR_SEAMS, LIGHT, onForm } from './face-plane.ts'
import { drawHands } from './hand-stamp.ts'
import {
  type FaceLightOut,
  type KeyLightOut,
  NO_FABRICS,
  type PaintInput,
  type State1,
  type State2,
  type SurfacesOut,
} from './paint-state.ts'
import { FACE_KEY, KEY } from './paint-style.ts'
import { densityOf, isArm, isLeg } from './regions.ts'
import { DARK_MID, extraTones, fillTones } from './tones.ts'
import { hypot3, must, norm, sq } from './vec.ts'
/** The painter's own copy of the G-buffer, the neck filled under the jaw, and the normals smoothed within each part. */
export function surfaces(s: PaintInput): SurfacesOut {
  const { cloth, g, hands, materials, skin, style } = s

  const { w, h } = g,
    n = w * h,
    ink = INK_RGB
  const tones = materials.map((m) => fillTones(tonesOf(m), m.flat ? 0 : style.cool)),
    D = densityOf(w),
    ppm = 36.9 * D
  // The fabrics (H5) of the materials; with no cloth channel, none is read.
  const fabrics = cloth ? materials.map((m) => (m.fabric ? (fabricOf(m.fabric) ?? null) : null)) : NO_FABRICS
  // The skin's family: the skin, and any surface painted in its tones alone (an ear's rim and bowl), which takes its line.
  const skinSet = new Set(skin >= 0 ? must(tones, skin) : []),
    skinny = tones.map((t, i) => i === skin || (skin >= 0 && t.every((c) => skinSet.has(c))))
  // Black cloth (a dark ramp, not skin, hair or a flat mark) has its own darks and form (extraTones, the rim below).
  const hairy = (p: number) => p >= (HAIR_SEAMS[0] ?? Number.NaN) && p < (HAIR_SEAMS[1] ?? Number.NaN),
    onHair = new Uint8Array(materials.length)
  for (let k = 0; k < n; k++)
    if ((g.material[k] ?? Number.NaN) >= 0 && hairy(g.part[k] ?? Number.NaN))
      onHair[g.material[k] ?? Number.NaN] = 1
  const darkRamp = materials.map(
    (m, i) =>
      !m.strands &&
      !m.flat &&
      !(skinny[i] ?? false) &&
      !(onHair[i] ?? Number.NaN) &&
      oklab(must(tones, i)[1] ?? Number.NaN)[0] < DARK_MID,
  )
  const extra = tones.map((t, i) =>
    extraTones(t, must(materials, i).ramp, skinny[i] ?? false, darkRamp[i] ?? false),
  )
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
  const filled = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && (material[y * w + x] ?? Number.NaN) >= 0
  // The neck under the jaw: a short run of empty texels between the head's skin above and the neck's below (a neck seen
  // from above, the jaw's underside hiding where it meets the head) is the neck in the jaw's shadow, not a hole, so no
  // outline cuts across the throat. It fills from the neck below, and the jaw's crevice shades it.
  if (skin >= 0)
    for (let x = 0; x < w; x++)
      for (let y = 1; y < h - 1; y++) {
        const k = y * w + x
        if (
          (material[k] ?? Number.NaN) >= 0 ||
          (part[k - w] ?? Number.NaN) !== FACE_SEAM ||
          (material[k - w] ?? Number.NaN) !== skin
        )
          continue
        let e = y
        while (e < h - 1 && e - y < 2 * D && (material[e * w + x] ?? Number.NaN) < 0) e++
        const q = e * w + x
        if ((material[q] ?? Number.NaN) !== skin || (part[q] ?? Number.NaN) === FACE_SEAM) continue
        for (let yy = y; yy < e; yy++) {
          const o = yy * w + x
          material[o] = material[q] ?? Number.NaN
          part[o] = part[q] ?? Number.NaN
          group[o] = group[q] ?? Number.NaN
          depth[o] = depth[q] ?? Number.NaN
          for (let i = 0; i < 3; i++) {
            normal[o * 3 + i] = normal[q * 3 + i] ?? Number.NaN
            place[o * 3 + i] = place[q * 3 + i] ?? Number.NaN
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
      if ((material[k] ?? Number.NaN) < 0) continue
      let sx = 0,
        sy = 0,
        sz = 0
      const r = (part[k] ?? Number.NaN) === FACE_SEAM ? Math.max(1, R - 1) : R
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx,
            yy = y + dy
          if (!filled(xx, yy) || dx * dx + dy * dy > r * r + r) continue
          // Within the part, and across a join into the same region and cloth at nearly the same depth (an elbow, a knee),
          // so the light runs on through it: a smooth union for the shading.
          const q = yy * w + xx
          if (
            (part[q] ?? Number.NaN) !== (part[k] ?? Number.NaN) &&
            !(
              (group[q] ?? Number.NaN) === (group[k] ?? Number.NaN) &&
              (material[q] ?? Number.NaN) === (material[k] ?? Number.NaN) &&
              Math.abs((depth[q] ?? Number.NaN) - (depth[k] ?? Number.NaN)) < style.blend
            )
          )
            continue
          sx += normal[q * 3] ?? Number.NaN
          sy += normal[q * 3 + 1] ?? Number.NaN
          sz += normal[q * 3 + 2] ?? Number.NaN
        }
      if (sz < 0) {
        sx = -sx
        sy = -sy
        sz = -sz
      }
      const l = hypot3(sx, sy, sz) || 1
      sm[k * 3] = sx / l
      sm[k * 3 + 1] = sy / l
      sm[k * 3 + 2] = sz / l
    }
  return {
    w,
    h,
    n,
    ink,
    tones,
    D,
    ppm,
    fabrics,
    skinny,
    hairy,
    darkRamp,
    extra,
    stains,
    material,
    part,
    group,
    depth,
    place,
    handTone,
    filled,
    sm,
  }
}

/** The face on its planes, and its light blocked in as a pixel artist blocks it. */
export function faceLight(s: State1): FaceLightOut {
  const { face, skin, style, D, depth, h, material, n, part, sm, w } = s

  // The face on its planes (facePlane): each texel of its skin found on the head's form through the head's frame, its
  // normal turned to its plane, back into view axes (the normal map carries the planes too).
  const isFace = (k: number) =>
    skin >= 0 && (part[k] ?? Number.NaN) === FACE_SEAM && (material[k] ?? Number.NaN) === skin
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
      (i) =>
        (R[i * 3] ?? Number.NaN) * FACE_KEY[0] +
        (R[i * 3 + 1] ?? Number.NaN) * FACE_KEY[1] +
        (R[i * 3 + 2] ?? Number.NaN) * FACE_KEY[2],
    )
    const hk = [
        0.5 * (kh[0] ?? Number.NaN),
        0.5 * (kh[1] ?? Number.NaN) + 0.1,
        0.5 * (kh[2] ?? Number.NaN) + 0.75,
      ],
      hl = norm(hk),
      HK = hk.map((c) => c / hl)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if (!isFace(k)) continue
        const v = [(x + 0.5 - o[0]) / fp, (o[1] - y - 0.5) / fp, (depth[k] ?? Number.NaN) - o[2]],
          s = [sm[k * 3] ?? Number.NaN, sm[k * 3 + 1] ?? Number.NaN, sm[k * 3 + 2] ?? Number.NaN]
        const hp = [0, 1, 2].map(
          (i) =>
            (R[i * 3] ?? Number.NaN) * (v[0] ?? Number.NaN) +
            (R[i * 3 + 1] ?? Number.NaN) * (v[1] ?? Number.NaN) +
            (R[i * 3 + 2] ?? Number.NaN) * (v[2] ?? Number.NaN),
        )
        const hn = [0, 1, 2].map(
          (i) =>
            (R[i * 3] ?? Number.NaN) * (s[0] ?? Number.NaN) +
            (R[i * 3 + 1] ?? Number.NaN) * (s[1] ?? Number.NaN) +
            (R[i * 3 + 2] ?? Number.NaN) * (s[2] ?? Number.NaN),
        )
        // The light on the facets mostly (so the cheekbone's top takes it as the brow's does), the normal map's on the
        // form half, so a turned head still turns as a whole.
        const pl = facePlane(F, hw, H, hp, hn),
          kl = onForm(pl, hn, 0.8),
          pn = onForm(pl, hn, 0.5)
        facePlaneOf[k] = pl[3]
        faceKeyed[k] =
          (kl[0] ?? Number.NaN) * (HK[0] ?? Number.NaN) +
          (kl[1] ?? Number.NaN) * (HK[1] ?? Number.NaN) +
          (kl[2] ?? Number.NaN) * (HK[2] ?? Number.NaN)
        for (let c = 0; c < 3; c++)
          sm[k * 3 + c] =
            (R[c] ?? Number.NaN) * (pn[0] ?? Number.NaN) +
            (R[3 + c] ?? Number.NaN) * (pn[1] ?? Number.NaN) +
            (R[6 + c] ?? Number.NaN) * (pn[2] ?? Number.NaN)
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
        ? (faceKeyed[k] ?? Number.NaN)
        : (sm[k * 3] ?? Number.NaN) * FACE_KEY[0] +
          (sm[k * 3 + 1] ?? Number.NaN) * FACE_KEY[1] +
          (sm[k * 3 + 2] ?? Number.NaN) * FACE_KEY[2]
      : (sm[k * 3] ?? Number.NaN) * KEY[0] +
        (sm[k * 3 + 1] ?? Number.NaN) * KEY[1] +
        (sm[k * 3 + 2] ?? Number.NaN) * KEY[2]
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
            if (dx * dx + dy * dy > sq(D - 1) + D - 1 || xx < 0 || yy < 0 || xx >= w || yy >= h || !isFace(q))
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
    for (let k = 0; k < n; k++) if (isFace(k)) fs.push(faceLit[k] ?? Number.NaN)
    if (fs.length > 8) {
      fs.sort((a, b) => a - b)
      const th = style.face,
        at = (p: number) => fs[Math.min(fs.length - 1, Math.floor(fs.length * p))] ?? Number.NaN
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
        for (let k = 0; k < n; k++)
          if (isFace(k) && (facePlaneOf[k] ?? Number.NaN))
            must(by, facePlaneOf[k] ?? Number.NaN).push(faceLit[k] ?? Number.NaN)
        const planeTh = by.map((v, i) => {
          v.sort((a, b) => a - b)
          return v.length && (LIGHT[i] ?? Number.NaN)
            ? Math.max(
                floor,
                (v[Math.min(v.length - 1, Math.floor(v.length * (1 - (LIGHT[i] ?? Number.NaN))))] ??
                  Number.NaN) - 1e-6,
              )
            : Infinity
        })
        for (let k = 0; k < n; k++)
          if (
            isFace(k) &&
            (facePlaneOf[k] ?? Number.NaN) &&
            (faceLit[k] ?? Number.NaN) >= (planeTh[facePlaneOf[k] ?? Number.NaN] ?? Number.NaN)
          )
            faceLight[k] = 1
      }
    }
  }
  return { isFace, lightOf, faceLit, faceTh, faceLight }
}

/** The key light on each texel, and the thresholds that cut it into tones. */
export function keyLight(s: State2): KeyLightOut {
  const {
    bends,
    materials,
    skin,
    style,
    D,
    darkRamp,
    group,
    hairy,
    material,
    n,
    part,
    place,
    skinny,
    faceLit,
    faceTh,
    isFace,
    lightOf,
  } = s

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
  const alongBone = (mi: number) => (skinny[mi] ?? false) || (darkRamp[mi] ?? false)
  for (let k = 0; k < n; k++)
    if (
      (material[k] ?? Number.NaN) >= 0 &&
      alongBone(material[k] ?? Number.NaN) &&
      (isArm(group[k] ?? Number.NaN) || isLeg(group[k] ?? Number.NaN))
    ) {
      const y = P[k * 3 + 1] ?? Number.NaN,
        r = limbSpan.get(part[k] ?? Number.NaN)
      if (r) {
        r[0] = Math.min(r[0], y)
        r[1] = Math.max(r[1], y)
      } else limbSpan.set(part[k] ?? Number.NaN, [y, y])
    }
  /** How far down its bone a limb's texel lies, 0 at the joint over it to 1 at the next: by the limb's joints (`bends`)
   * where its part lies between them (a sleeve from the shoulder to the wrist turns at the elbow), else down its part. */
  const downBone = (k: number, span: [number, number]) => {
    const j = bends[group[k] ?? Number.NaN],
      y = P[k * 3 + 1] ?? Number.NaN
    if (j && span[0] >= (j[j.length - 1] ?? Number.NaN) - 0.02 && span[1] <= (j[0] ?? Number.NaN) + 0.15)
      for (let i = 0; i < j.length - 1; i++)
        if (y >= (j[i + 1] ?? Number.NaN) || i === j.length - 2)
          return Math.max(
            0,
            Math.min(1, ((j[i] ?? Number.NaN) - y) / ((j[i] ?? Number.NaN) - (j[i + 1] ?? Number.NaN))),
          )
    return (span[1] - y) / (span[1] - span[0])
  }
  for (let k = 0; k < n; k++) {
    const mi = material[k] ?? Number.NaN
    if (mi < 0) continue
    const m = must(materials, mi),
      q3 = k * 3,
      streaks = m.strands ? style.strands : (m.streaks ?? 0)
    let f = isFace(k) ? (faceLit[k] ?? Number.NaN) : lightOf(k)
    if (streaks) {
      grains[k] =
        (noise3((P[q3] ?? Number.NaN) * 34, (P[q3 + 1] ?? Number.NaN) * 9, (P[q3 + 2] ?? Number.NaN) * 34) -
          0.5) *
        streaks
      f += grains[k] ?? Number.NaN
    }
    const span = alongBone(mi) ? limbSpan.get(part[k] ?? Number.NaN) : undefined
    if (span && span[1] - span[0] > 0.01)
      f += ((skinny[mi] ?? false) ? 0.14 : 0.3) * cos(Math.PI * (downBone(k, span) - 0.3))
    if (style.folds && mi !== skin && !m.strands && (part[k] ?? Number.NaN) !== FACE_SEAM)
      f +=
        ((darkRamp[mi] ?? false) ? 0.5 : 1) *
        (noise3(
          ((P[q3] ?? Number.NaN) + (P[q3 + 1] ?? Number.NaN) * 0.6) * 12,
          (P[q3 + 1] ?? Number.NaN) * 2.5,
          ((P[q3 + 2] ?? Number.NaN) - (P[q3 + 1] ?? Number.NaN) * 0.4) * 12,
        ) -
          0.5) *
        style.folds
    lit[k] = f
  }
  /** A surface the painter models as a whole: a garment's or the body's part, in one material (not the face, the hair,
   * a mark or a flat material). */
  const modelled = (k: number) =>
    (material[k] ?? Number.NaN) >= 0 &&
    (part[k] ?? Number.NaN) >= 0 &&
    (part[k] ?? Number.NaN) !== FACE_SEAM &&
    !hairy(part[k] ?? Number.NaN) &&
    !must(materials, material[k] ?? Number.NaN).flat &&
    !must(materials, material[k] ?? Number.NaN).strands
  const surfaceOf = (k: number) => (part[k] ?? Number.NaN) * 4096 + (material[k] ?? Number.NaN)
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
        a.push(lit[k] ?? Number.NaN)
      }
    for (const [key, fs] of by) {
      // A bare limb's part models whatever its size, so a thin forearm still has its light, mid and shadow.
      if (fs.length < style.surface[2] * D * D && !limbSpan.has(Math.floor(key / 4096))) continue
      fs.sort((a, b) => a - b)
      const th = must(materials, key % 4096).tones ?? style.tones,
        at = (p: number) => fs[Math.min(fs.length - 1, Math.floor(fs.length * p))] ?? Number.NaN
      // A dark ramp's light is a plane of its own, a quarter of it on the side that faces the key (black has three
      // values, and its light is the one that shows its form), its shadow the far third.
      const dk = darkRamp[key % 4096] ?? false,
        t1 = Math.max(th[1], at(dk ? 0.3 : style.surface[0])),
        t0 = dk ? Math.max(t1 + 0.02, at(0.75)) : Math.max(th[0], at(1 - style.surface[1]), t1 + 0.02)
      surfTh.set(key, [t0, t1, Math.min(th[2], t1 - 0.02)])
    }
  }
  const thOf = (k: number): readonly number[] =>
    faceTh && (material[k] ?? Number.NaN) === skin && (part[k] ?? Number.NaN) === FACE_SEAM
      ? faceTh
      : (surfTh.get(surfaceOf(k)) ?? must(materials, material[k] ?? Number.NaN).tones ?? style.tones)
  return { lit, grains, P, modelled, thOf }
}
