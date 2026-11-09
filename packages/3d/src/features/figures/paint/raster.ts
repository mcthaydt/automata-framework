import { GROUP } from '../body/mesh.ts'
import { hypot3 } from './vec.ts'
/**
 * The figure's own small render target. A CPU rasteriser draws the posed parts `supersample` times larger than the cell
 * into a G-buffer (depth, part, material, group, normal, and the surface's own place); `resolve` gives each texel the
 * part that owns it (the nearest that covers enough of it, else the largest), so every texel is one clean cluster of one
 * part, never a sliver; `cleanup` removes the orphans, spurs and pinholes pixel artists remove by hand, and `blendJoins`
 * and `smoothContour` join the parts of one surface and soften the contour. The decal stamps then put the marks (the
 * face's, a hand's) on the surface by the part they sit on, and `noise3` is the surface's own noise. The painter
 * (paint.ts) paints the result.
 *
 * View space: x right, y up, z toward the camera.
 */
/** The rasteriser's own knobs. */
export interface Style {
  /** Subsamples per texel along each axis. */
  supersample: number
  /** A part keeps a texel if it is the nearest part there and covers at least this share of it. */
  priority: number
  /** A texel is filled when the figure covers at least this share of it. */
  coverage: number
  /** Remove orphan texels, single-texel spurs and pinholes. */
  cleanup: boolean
}
export const STYLE: Style = { supersample: 3, priority: 0.3, coverage: 0.45, cleanup: true }
/** Ints per triangle in a soup, and floats per vertex (texel x, y, depth, normal, surface place). */
export const TRI = 6,
  VERT = 9
/** A triangle soup in view space, in texels (x right, y down) with depth in metres toward the camera. */
export interface Soup {
  /** Per vertex: texel x, texel y, depth, normal x, y, z, and the surface's own place (rest position) x, y, z. */
  verts: Float32Array
  count: number
  /** Per triangle: three vertex indices, then the material, group and part. */
  tris: Int32Array
  triCount: number
}
export interface GBuffer {
  w: number
  h: number
  depth: Float32Array
  material: Int16Array
  group: Int16Array
  part: Int16Array
  normal: Float32Array
  /** The surface's rest position at each texel: where its grain is looked up. */
  place: Float32Array
}
export function gbuffer(w: number, h: number): GBuffer {
  return {
    w,
    h,
    depth: new Float32Array(w * h),
    material: new Int16Array(w * h),
    group: new Int16Array(w * h),
    part: new Int16Array(w * h),
    normal: new Float32Array(w * h * 3),
    place: new Float32Array(w * h * 3),
  }
}
/** Cloth that hangs over the legs (the trunk's and a skirt's: +1) and the legs (−1): see `rasterize`'s `over`. */
const LAYER = new Int8Array(16)
LAYER[GROUP.torso] = LAYER[GROUP.skirt] = 1
LAYER[GROUP.legL] = LAYER[GROUP.legR] = -1
/**
 * Z-buffered, point-sampled at sample centres. Larger depth is nearer. Edge functions step incrementally along each row.
 * Cloth over the legs wins a tie with a leg of another material within `over` (m), the most a stride's thigh runs ahead
 * of a hem that follows it late, so the leg never shows through a top's or a skirt's hem.
 */
export function rasterize(soup: Soup, g: GBuffer, over = 0.1): void {
  const { w, h, depth, material, group, part, normal, place } = g,
    v = soup.verts
  depth.fill(-Infinity)
  material.fill(-1)
  group.fill(-1)
  part.fill(-1)
  for (let t = 0; t < soup.triCount; t++) {
    const T = t * TRI,
      i0 = (soup.tris[T] ?? Number.NaN) * VERT,
      i1 = (soup.tris[T + 1] ?? Number.NaN) * VERT,
      i2 = (soup.tris[T + 2] ?? Number.NaN) * VERT,
      mat = soup.tris[T + 3] ?? Number.NaN,
      grp = soup.tris[T + 4] ?? Number.NaN,
      prt = soup.tris[T + 5] ?? Number.NaN
    const x0 = v[i0] ?? Number.NaN,
      y0 = v[i0 + 1] ?? Number.NaN,
      x1 = v[i1] ?? Number.NaN,
      y1 = v[i1 + 1] ?? Number.NaN,
      x2 = v[i2] ?? Number.NaN,
      y2 = v[i2 + 1] ?? Number.NaN
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    if (Math.abs(area) < 1e-9) continue
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))),
      maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)))
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))),
      maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)))
    if (minX > maxX || minY > maxY) continue
    // Barycentrics a, b at a sample centre are linear in x and y: their per-texel steps.
    const inv = 1 / area,
      adx = (y1 - y2) * inv,
      bdx = (y2 - y0) * inv
    const z0 = v[i0 + 2] ?? Number.NaN,
      z1 = v[i1 + 2] ?? Number.NaN,
      z2 = v[i2 + 2] ?? Number.NaN
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5,
        px = minX + 0.5
      let a = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv,
        b = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv
      for (let x = minX; x <= maxX; x++, a += adx, b += bdx) {
        const c = 1 - a - b
        if (a < -1e-7 || b < -1e-7 || c < -1e-7) continue
        const z = a * z0 + b * z1 + c * z2,
          k = y * w + x,
          layer = LAYER[grp] ?? Number.NaN
        if (
          z +
            (layer &&
            (group[k] ?? Number.NaN) >= 0 &&
            (LAYER[group[k] ?? Number.NaN] ?? Number.NaN) === -layer &&
            (material[k] ?? Number.NaN) !== mat
              ? layer * over
              : 0) <=
          (depth[k] ?? Number.NaN)
        )
          continue
        depth[k] = z
        material[k] = mat
        group[k] = grp
        part[k] = prt
        const k3 = k * 3
        normal[k3] =
          a * (v[i0 + 3] ?? Number.NaN) + b * (v[i1 + 3] ?? Number.NaN) + c * (v[i2 + 3] ?? Number.NaN)
        normal[k3 + 1] =
          a * (v[i0 + 4] ?? Number.NaN) + b * (v[i1 + 4] ?? Number.NaN) + c * (v[i2 + 4] ?? Number.NaN)
        normal[k3 + 2] =
          a * (v[i0 + 5] ?? Number.NaN) + b * (v[i1 + 5] ?? Number.NaN) + c * (v[i2 + 5] ?? Number.NaN)
        place[k3] =
          a * (v[i0 + 6] ?? Number.NaN) + b * (v[i1 + 6] ?? Number.NaN) + c * (v[i2 + 6] ?? Number.NaN)
        place[k3 + 1] =
          a * (v[i0 + 7] ?? Number.NaN) + b * (v[i1 + 7] ?? Number.NaN) + c * (v[i2 + 7] ?? Number.NaN)
        place[k3 + 2] =
          a * (v[i0 + 8] ?? Number.NaN) + b * (v[i1 + 8] ?? Number.NaN) + c * (v[i2 + 8] ?? Number.NaN)
      }
    }
  }
}
/**
 * Supersampled G-buffer → cell G-buffer. A texel is filled where the figure covers `coverage` of it; it belongs to the
 * nearest part covering `priority` of it (so a thin arm in front of the body stays whole), else to the part covering
 * most. Its normal is that part's mean normal there, its depth that part's nearest.
 */
export function resolve(hi: GBuffer, lo: GBuffer, s: number, style: Style = STYLE): void {
  // Scratch per texel, at most s² candidate parts: their ids, sample counts, nearest depth and its sample, and sums.
  const n = s * s,
    ids = new Int32Array(n),
    counts = new Int32Array(n),
    nearest = new Float64Array(n),
    firstAt = new Int32Array(n),
    sums = new Float64Array(n * 6)
  lo.depth.fill(-Infinity)
  lo.material.fill(-1)
  lo.group.fill(-1)
  lo.part.fill(-1)
  for (let y = 0; y < lo.h; y++)
    for (let x = 0; x < lo.w; x++) {
      let m = 0,
        filled = 0
      for (let sy = 0; sy < s; sy++)
        for (let sx = 0; sx < s; sx++) {
          const k = (y * s + sy) * hi.w + x * s + sx,
            p = hi.part[k] ?? Number.NaN
          if (p < 0) continue
          filled++
          let i = 0
          while (i < m && (ids[i] ?? Number.NaN) !== p) i++
          if (i === m) {
            ids[i] = p
            counts[i] = 0
            nearest[i] = -Infinity
            firstAt[i] = k
            sums.fill(0, i * 6, i * 6 + 6)
            m++
          }
          counts[i] = (counts[i] ?? Number.NaN) + 1
          if ((hi.depth[k] ?? Number.NaN) > (nearest[i] ?? Number.NaN)) {
            nearest[i] = hi.depth[k] ?? Number.NaN
            firstAt[i] = k
          }
          const k3 = k * 3,
            o6 = i * 6
          sums[o6] = (sums[o6] ?? Number.NaN) + (hi.normal[k3] ?? Number.NaN)
          sums[o6 + 1] = (sums[o6 + 1] ?? Number.NaN) + (hi.normal[k3 + 1] ?? Number.NaN)
          sums[o6 + 2] = (sums[o6 + 2] ?? Number.NaN) + (hi.normal[k3 + 2] ?? Number.NaN)
          sums[o6 + 3] = (sums[o6 + 3] ?? Number.NaN) + (hi.place[k3] ?? Number.NaN)
          sums[o6 + 4] = (sums[o6 + 4] ?? Number.NaN) + (hi.place[k3 + 1] ?? Number.NaN)
          sums[o6 + 5] = (sums[o6 + 5] ?? Number.NaN) + (hi.place[k3 + 2] ?? Number.NaN)
        }
      if (filled < n * style.coverage) continue
      let pick = 0,
        front = -1
      for (let i = 1; i < m; i++) if ((counts[i] ?? Number.NaN) > (counts[pick] ?? Number.NaN)) pick = i
      for (let i = 0; i < m; i++)
        if (
          (counts[i] ?? Number.NaN) >= n * style.priority &&
          (front < 0 || (nearest[i] ?? Number.NaN) > (nearest[front] ?? Number.NaN))
        )
          front = i
      if (front >= 0) pick = front
      const o = y * lo.w + x,
        o6 = pick * 6,
        c = counts[pick] ?? Number.NaN,
        k = firstAt[pick] ?? Number.NaN
      const l = hypot3(sums[o6] ?? Number.NaN, sums[o6 + 1] ?? Number.NaN, sums[o6 + 2] ?? Number.NaN) || 1
      lo.part[o] = ids[pick] ?? Number.NaN
      lo.material[o] = hi.material[k] ?? Number.NaN
      lo.group[o] = hi.group[k] ?? Number.NaN
      lo.depth[o] = nearest[pick] ?? Number.NaN
      lo.normal[o * 3] = (sums[o6] ?? Number.NaN) / l
      lo.normal[o * 3 + 1] = (sums[o6 + 1] ?? Number.NaN) / l
      lo.normal[o * 3 + 2] = (sums[o6 + 2] ?? Number.NaN) / l
      lo.place[o * 3] = (sums[o6 + 3] ?? Number.NaN) / c
      lo.place[o * 3 + 1] = (sums[o6 + 4] ?? Number.NaN) / c
      lo.place[o * 3 + 2] = (sums[o6 + 5] ?? Number.NaN) / c
    }
}
const copyTexel = (g: GBuffer, to: number, from: number) => {
  for (let i = 0; i < 3; i++) g.place[to * 3 + i] = g.place[from * 3 + i] ?? Number.NaN
  g.part[to] = g.part[from] ?? Number.NaN
  g.material[to] = g.material[from] ?? Number.NaN
  g.group[to] = g.group[from] ?? Number.NaN
  g.depth[to] = g.depth[from] ?? Number.NaN
  g.normal[to * 3] = g.normal[from * 3] ?? Number.NaN
  g.normal[to * 3 + 1] = g.normal[from * 3 + 1] ?? Number.NaN
  g.normal[to * 3 + 2] = g.normal[from * 3 + 2] ?? Number.NaN
}
/** The hand pass: an orphan texel (no 4-neighbour of its part) joins its neighbours' part; a spur (one filled
 * neighbour) is removed; a pinhole (three or four filled neighbours) is filled. */
export function cleanup(g: GBuffer): void {
  // The same rules as written out with arrays, without allocating per texel (it runs on every raster).
  const { w, h, part } = g,
    kill: number[] = [],
    fill: number[] = [],
    join: number[] = []
  const nb = new Int32Array(4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      let n = 0
      if (x > 0 && (part[k - 1] ?? Number.NaN) >= 0) nb[n++] = k - 1
      if (x < w - 1 && (part[k + 1] ?? Number.NaN) >= 0) nb[n++] = k + 1
      if (y > 0 && (part[k - w] ?? Number.NaN) >= 0) nb[n++] = k - w
      if (y < h - 1 && (part[k + w] ?? Number.NaN) >= 0) nb[n++] = k + w
      if ((part[k] ?? Number.NaN) < 0) {
        if (n >= 3) {
          let best = nb[0] ?? Number.NaN
          for (let i = 1; i < n; i++)
            if ((g.depth[nb[i] ?? Number.NaN] ?? Number.NaN) > (g.depth[best] ?? Number.NaN))
              best = nb[i] ?? Number.NaN
          fill.push(k, best)
        }
        continue
      }
      if (n <= 1) {
        kill.push(k)
        continue
      }
      if (
        n === 4 &&
        (part[nb[0] ?? Number.NaN] ?? Number.NaN) !== (part[k] ?? Number.NaN) &&
        (part[nb[1] ?? Number.NaN] ?? Number.NaN) !== (part[k] ?? Number.NaN) &&
        (part[nb[2] ?? Number.NaN] ?? Number.NaN) !== (part[k] ?? Number.NaN) &&
        (part[nb[3] ?? Number.NaN] ?? Number.NaN) !== (part[k] ?? Number.NaN)
      ) {
        // The neighbours' commonest part takes the orphan (the first of the commonest, in neighbour order).
        let bestPart = -1,
          bestCount = 0
        for (let i = 0; i < 4; i++) {
          const p = part[nb[i] ?? Number.NaN] ?? Number.NaN
          let c = 0
          for (let j = 0; j < 4; j++) if ((part[nb[j] ?? Number.NaN] ?? Number.NaN) === p) c++
          if (c > bestCount) {
            bestCount = c
            bestPart = p
          }
        }
        if (bestCount >= 2)
          for (let i = 0; i < 4; i++)
            if ((part[nb[i] ?? Number.NaN] ?? Number.NaN) === bestPart) {
              join.push(k, nb[i] ?? Number.NaN)
              break
            }
      }
    }
  for (const k of kill) {
    part[k] = -1
    g.material[k] = -1
    g.group[k] = -1
    g.depth[k] = -Infinity
  }
  for (let i = 0; i < fill.length; i += 2) copyTexel(g, fill[i] ?? Number.NaN, fill[i + 1] ?? Number.NaN)
  for (let i = 0; i < join.length; i += 2) copyTexel(g, join[i] ?? Number.NaN, join[i + 1] ?? Number.NaN)
}
/**
 * The neckline, as a pixel artist cleans a collar: where the neck meets a top, a run of the neck's texels in a row, at most
 * `min(2D, 4)` long (D the cell's density; the cap of 4 keeps the round bottom of the neck's U at D4), with one non-neck
 * material on its left, its right and under every texel of it, is a skin tooth in the cloth; it joins that material, each
 * texel taking its nearer side's neighbour (the left half the left's, the right half the right's). The bottom row first, so a peg two rows tall goes too. `neck` holds the G-buffer's part ids
 * of the neck (the parts tagged NECK); nothing else is touched: not a hand, not a finger, not the hair.
 */
export function neckline(g: GBuffer, neck: Set<number>): void {
  const { w, h, part, material, group } = g,
    D = Math.max(1, Math.round(w / 64)),
    isNeck = (k: number) => neck.has(part[k] ?? Number.NaN)
  for (let y = h - 2; y >= 1; y--)
    for (let x = 1; x < w - 1; x++) {
      const k = y * w + x
      if (!isNeck(k) || isNeck(k - 1)) continue
      let n = 0
      while (x + n < w - 1 && isNeck(k + n)) n++
      const l = k - 1,
        r = k + n,
        m = material[l] ?? Number.NaN
      // Cloth is not the head's group (the hair, which hangs past the collar, is never what a tooth joins).
      const cloth = (q: number) =>
        (part[q] ?? Number.NaN) >= 0 &&
        !neck.has(part[q] ?? Number.NaN) &&
        (group[q] ?? Number.NaN) !== GROUP.head &&
        (material[q] ?? Number.NaN) === m
      let tooth = n <= Math.min(2 * D, 4) && cloth(l) && cloth(r)
      for (let i = 0; tooth && i < n; i++) tooth = cloth(k + i + w)
      if (tooth) for (let i = 0; i < n; i++) copyTexel(g, k + i, i < n / 2 ? l : r)
      x += n - 1
    }
}
/**
 * Joins, as a smooth union would make them (screen-space): an empty texel pinched between two texels of one group (left
 * and right, or above and below) at nearly the same depth is the notch where two rounded parts meet; it takes the nearer
 * side. Two groups (the legs, an arm against the body) never join.
 */
export function blendJoins(g: GBuffer, within = 0.06): void {
  const { w, h, part, group, depth } = g,
    fill: number[] = []
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const k = y * w + x
      if ((part[k] ?? Number.NaN) >= 0) continue
      for (const [a, b] of [
        [k - 1, k + 1],
        [k - w, k + w],
      ] as [number, number][]) {
        if (
          (part[a] ?? Number.NaN) < 0 ||
          (part[b] ?? Number.NaN) < 0 ||
          (group[a] ?? Number.NaN) !== (group[b] ?? Number.NaN) ||
          Math.abs((depth[a] ?? Number.NaN) - (depth[b] ?? Number.NaN)) > within
        )
          continue
        fill.push(k, (depth[a] ?? Number.NaN) >= (depth[b] ?? Number.NaN) ? a : b)
        break
      }
    }
  for (let i = 0; i < fill.length; i += 2) copyTexel(g, fill[i] ?? Number.NaN, fill[i + 1] ?? Number.NaN)
}
/**
 * The contour as a pixel artist draws a long edge: its steps change length monotonically, so a bump or a dent of a texel
 * on a near-straight edge (a run of up to `3D` stepping out of line and back, with half as much again in line either
 * side, on one form: its group, or one cloth across groups, whichever parts meet along it, so a sleeve's step onto its
 * cuff or a trouser's from seat to leg is cleared too) is cleared or filled to the line. Faces and hair (the head
 * group) keep their drawn edge.
 */
export function smoothContour(g: GBuffer): void {
  const { w, h, part, group, material } = g,
    D = Math.max(1, Math.round(w / 64))
  // Each side in turn as the left edge: u runs along it, v across it, outward toward v − 1.
  for (let o = 0; o < 4; o++) {
    const U = o < 2 ? h : w,
      V = o < 2 ? w : h
    const at = (u: number, v: number) =>
      o < 2 ? u * w + (o === 0 ? v : w - 1 - v) : (o === 2 ? v : h - 1 - v) * w + u
    const on = (u: number, v: number) =>
      u >= 0 && v >= 0 && u < U && v < V && (part[at(u, v)] ?? Number.NaN) >= 0
    const edge = (u: number, v: number) => on(u, v) && !on(u, v - 1)
    const clear: number[] = [],
      fill: number[] = []
    for (let v = 1; v < V - 1; v++)
      for (let u = 1; u < U; u++) {
        if (!edge(u, v) || edge(u - 1, v)) continue
        let L = 0
        while (L <= 3 * D && edge(u + L, v)) L++
        if (L > 3 * D) continue
        const F = Math.max(2, Math.ceil(1.5 * L))
        const k0 = at(u, v),
          g0 = group[k0] ?? Number.NaN,
          m0 = material[k0] ?? Number.NaN
        if (g0 === GROUP.head) continue
        /** One form with the run's: its group, or its cloth on another group (never the head's). */
        const one = (k: number) =>
          (group[k] ?? Number.NaN) !== GROUP.head &&
          ((group[k] ?? Number.NaN) === g0 || (material[k] ?? Number.NaN) === m0)
        const flank = (dv: number) => {
          for (let i = 1; i <= F; i++) if (!edge(u - i, v + dv) || !one(at(u - i, v + dv))) return false
          for (let i = 0; i < F; i++)
            if (!edge(u + L + i, v + dv) || !one(at(u + L + i, v + dv))) return false
          return true
        }
        if (flank(1)) {
          let inside = true
          for (let i = 0; i < L; i++) inside &&= on(u + i, v + 1) && one(at(u + i, v + 1))
          if (inside) for (let i = 0; i < L; i++) clear.push(at(u + i, v))
        } else if (flank(-1)) for (let i = 0; i < L; i++) fill.push(at(u + i, v - 1), at(u + i, v))
      }
    for (const k of clear) {
      part[k] = -1
      g.material[k] = -1
      g.group[k] = -1
      g.depth[k] = -Infinity
    }
    for (let i = 0; i < fill.length; i += 2) copyTexel(g, fill[i] ?? Number.NaN, fill[i + 1] ?? Number.NaN)
  }
}
