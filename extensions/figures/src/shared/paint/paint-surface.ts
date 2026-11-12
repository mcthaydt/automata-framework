import type { AfterPrepare } from './paint-prepare'
import { FACE_SEAM } from './paint-style'

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
