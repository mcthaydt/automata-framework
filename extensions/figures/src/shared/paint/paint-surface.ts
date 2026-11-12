import { facePlane, onForm } from './paint-face'
import type { AfterPrepare } from './paint-prepare'
import { FACE_DEEP, FACE_KEY, FACE_SEAM, KEY, LIGHT } from './paint-style'

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
