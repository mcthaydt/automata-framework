import { isArm, isLeg, K2 } from './paint-budget'
import { facePlane, onForm } from './paint-face'
import type { AfterPrepare } from './paint-prepare'
import { FACE_DEEP, FACE_KEY, FACE_SEAM, KEY, LIGHT } from './paint-style'
import { noise3 } from './raster'

/**
 * The throat under the jaw (a short gap of empty texels between the head's skin and the neck's takes the neck),
 * and each part's normals smoothed over a round brush, so a part shades as one form.
 */
export function smoothSurfaces(ctx: AfterPrepare) {
  const { D, depth, filled, group, h, material, n, normal, part, place, skin, style, w } = ctx
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
  return { sm }
}

/** The context once `smoothSurfaces` has run. */
export type AfterSmoothSurfaces = AfterPrepare & ReturnType<typeof smoothSurfaces>

/**
 * The face on its planes (each texel of its skin found on the head's form through the head's frame, its normal
 * turned to its plane) and lit as a sprite's face is: the key turned toward its front, blocked in to clean shapes,
 * with its tone thresholds and the light of each front plane.
 */
export function faceForm(ctx: AfterSmoothSurfaces) {
  const { D, depth, face, h, material, n, part, skin, sm, style, w } = ctx
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
  return { isFace, lightOf, faceLit, faceTh, faceLight }
}

/** The context once `faceForm` has run. */
export type AfterFaceForm = AfterSmoothSurfaces & ReturnType<typeof faceForm>

/**
 * The key light on each texel (the hair's clumps, a limb's swell along its bone, cloth's folds) and the tone
 * thresholds of the large surfaces, so a hoodie turned to the key still has a shadow and a forearm's light sits on
 * the planes that face it.
 */
export function keyLight(ctx: AfterFaceForm) {
  const {
    D,
    bends,
    darkRamp,
    faceLit,
    faceTh,
    group,
    hairy,
    isFace,
    lightOf,
    material,
    materials,
    n,
    part,
    place,
    skin,
    skinny,
    style,
  } = ctx
  // The key light on each texel, on its smoothed normal. Hair in clumps along its strands, as the atlas paints it: noise
  // stretched down the hair, fixed to its surface; cloth's fine folds, the same noise (a long uniform hangs in
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
  return { lit, grains, P, modelled, surfaceOf, thOf }
}

/** The context once `keyLight` has run. */
export type AfterKeyLight = AfterFaceForm & ReturnType<typeof keyLight>

/**
 * Quilting: a sewn chamber (a surface beside another of its group in the same ramp under another name, as a
 * puffer's baffles are) is lit as one pillow by its rows across the band, its crest light, its body mid or shadow,
 * its last row before the stitch deep.
 */
export function quiltedBands(ctx: AfterKeyLight) {
  const { D, group, h, lit, material, materials, modelled, n, part, thOf, tones, w } = ctx
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
  return { band }
}

/** The context once `quiltedBands` has run. */
export type AfterQuiltedBands = AfterKeyLight & ReturnType<typeof quiltedBands>
