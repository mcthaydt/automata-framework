// The photo pipeline, a pixel artist's process run as code: a photo taken in flat grey light (so it carries a surface's
// own colours, not a sun's), scaled down at the texel scale it is seen at, then
//
//   facet → scale down → index to the DUEL palette → wear → clean up.
//
// - `facet`: an edge-keeping filter (Kuwahara) that flattens a photo into patches of one colour, so the scale-down that
//   follows keeps a brick's edge and loses its grit.
// - `resample`: an area average, wrapping round the tile's edges (a library photo is seamless).
// - `indexTone` / `indexPhoto`: the colour index. In tone mode a texel keeps only its light, as whole steps up or down a
//   swatch's DUEL ladder (and an accent's, where its hue parts from the surface's: brick and mortar, stone and moss), so
//   one photo of planks makes a red door and a teal one. In photo mode it keeps its colour: the photo's few main colours
//   (k-means in OKLab), each snapped to DUEL, so each texel lies on its own DUEL ramp.
// - `clean`: what the artist's thousands of clicks did, as rules: an orphan texel takes its neighbours' colour, and a
//   cluster under a few texels joins the cluster it borders most. No pixel is placed by hand.
//
// A texel's index is a label: `slot * 16 + value`. Slot 0 is the swatch's ladder and 1 its accent's, with value
// offset + 8 (a tone step, -8 to 7); slot 2 + r is DUEL ramp r, with value its step (0 to 7).

import { oklab } from '@automata/3d/props-kit'
import { duelIndexOf, hash3, rgbFromLab, STEPS } from './colour.ts'
import type { Image } from './png.ts'

/** OKLab, three floats a pixel. */
export interface Lab {
  readonly width: number
  readonly height: number
  readonly lab: Float32Array
}

export function labOf(image: Image): Lab {
  const { width, height, rgba } = image
  const lab = new Float32Array(width * height * 3)
  const seen = new Map<number, [number, number, number]>()
  for (let i = 0; i < width * height; i++) {
    const c = ((rgba[i * 4] ?? 0) << 16) | ((rgba[i * 4 + 1] ?? 0) << 8) | (rgba[i * 4 + 2] ?? 0)
    let v = seen.get(c)
    if (v === undefined) {
      v = oklab(c)
      seen.set(c, v)
    }
    lab.set(v, i * 3)
  }
  return { width, height, lab }
}

const wrap = (i: number, n: number): number => ((i % n) + n) % n

/** Kuwahara: each pixel takes the mean of the least varied of the four (r + 1)² squares it is a corner of. */
export function facet(src: Lab, radius: number): Lab {
  if (radius <= 0) return src
  const { width, height, lab } = src
  const out = new Float32Array(lab.length)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let best = Number.POSITIVE_INFINITY
      let bestL = 0
      let bestA = 0
      let bestB = 0
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        let n = 0
        let sumL = 0
        let sumA = 0
        let sumB = 0
        let squares = 0
        for (let j = 0; j <= radius; j++)
          for (let i = 0; i <= radius; i++) {
            const k = (wrap(y + sy * j, height) * width + wrap(x + sx * i, width)) * 3
            const L = lab[k] ?? 0
            sumL += L
            squares += L * L
            sumA += lab[k + 1] ?? 0
            sumB += lab[k + 2] ?? 0
            n++
          }
        const variance = squares / n - (sumL / n) ** 2
        if (variance < best) {
          best = variance
          bestL = sumL / n
          bestA = sumA / n
          bestB = sumB / n
        }
      }
      out.set([bestL, bestA, bestB], (y * width + x) * 3)
    }
  return { width, height, lab: out }
}

/**
 * Flatten: the photo's slow changes of light (a cloud's shade, a lens's falloff, a damp patch) taken out, so only the
 * surface's own light and dark (a mortar line, a plank's grain) are left to index: each pixel's lightness less `amount`
 * of a wide blur's (a box `radius` px, three passes, wrapping), plus the mean.
 */
export function flatten(src: Lab, radius: number, amount: number): Lab {
  if (amount <= 0 || radius <= 0) return src
  const { width, height, lab } = src
  const n = width * height
  let light: Float32Array = new Float32Array(n)
  let mean = 0
  for (let i = 0; i < n; i++) {
    light[i] = lab[i * 3] ?? 0
    mean += light[i] ?? 0
  }
  mean /= n
  const r = Math.max(1, Math.round(radius))
  const span = 2 * r + 1
  const box = (a: Float32Array, alongX: boolean): Float32Array => {
    const out = new Float32Array(n)
    for (let line = 0; line < (alongX ? height : width); line++) {
      const len = alongX ? width : height
      const get = (i: number): number =>
        a[alongX ? line * width + wrap(i, width) : wrap(i, height) * width + line] ?? 0
      let sum = 0
      for (let i = -r; i <= r; i++) sum += get(i)
      for (let i = 0; i < len; i++) {
        out[alongX ? line * width + i : i * width + line] = sum / span
        sum += get(i + r + 1) - get(i - r)
      }
    }
    return out
  }
  for (let pass = 0; pass < 3; pass++) light = box(box(light, true), false)
  const out = lab.slice()
  for (let i = 0; i < n; i++) out[i * 3] = (lab[i * 3] ?? 0) - amount * ((light[i] ?? 0) - mean)
  return { width, height, lab: out }
}

/** Area-average resampling to `W` × `H` (either way), wrapping at the edges. */
export function resample(src: Lab, W: number, H: number): Lab {
  const pass = (lab: Float32Array, w: number, h: number, N: number, alongX: boolean): Float32Array => {
    const n = alongX ? w : h
    const out = new Float32Array((alongX ? N * h : w * N) * 3)
    const s = n / N
    for (let o = 0; o < N; o++) {
      const a = o * s
      const b = a + s
      for (let line = 0; line < (alongX ? h : w); line++) {
        let L = 0
        let A = 0
        let B = 0
        let total = 0
        for (let i = Math.floor(a); i < Math.ceil(b - 1e-9); i++) {
          const cover = Math.min(b, i + 1) - Math.max(a, i)
          const j = wrap(i, n)
          const k = (alongX ? line * w + j : j * w + line) * 3
          L += (lab[k] ?? 0) * cover
          A += (lab[k + 1] ?? 0) * cover
          B += (lab[k + 2] ?? 0) * cover
          total += cover
        }
        out.set([L / total, A / total, B / total], (alongX ? line * N + o : o * w + line) * 3)
      }
    }
    return out
  }
  const across = pass(src.lab, src.width, src.height, W, true)
  return { width: W, height: H, lab: pass(across, W, src.height, H, false) }
}

/** A quarter turn of a photo (planks run up a wall instead of across). */
export function turned(src: Lab): Lab {
  const { width, height, lab } = src
  const out = new Float32Array(lab.length)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = (y * width + x) * 3
      out.set(lab.subarray(a, a + 3), (x * height + (height - 1 - y)) * 3)
    }
  return { width: height, height: width, lab: out }
}

export interface ToneOptions {
  /** OKLab lightness a tone step spans. */
  readonly contrast: number
  /** Offsets kept, lowest and highest. */
  readonly range: readonly [number, number]
  /** How far a texel's hue must part from the surface's (OKLab a, b distance) to take the accent; 0 for no accent. */
  readonly accent: number
}

const median = (xs: number[]): number => {
  const sorted = xs.slice().sort((a, b) => a - b)
  return sorted[sorted.length >> 1] ?? 0
}

/** Tone mode: each texel a step offset on the swatch's ladder (slot 0) or the accent's (slot 1). */
export function indexTone(src: Lab, options: ToneOptions): Uint16Array {
  const { width, height, lab } = src
  const n = width * height
  const out = new Uint16Array(n)
  let meanA = 0
  let meanB = 0
  for (let i = 0; i < n; i++) {
    meanA += lab[i * 3 + 1] ?? 0
    meanB += lab[i * 3 + 2] ?? 0
  }
  meanA /= n
  meanB /= n
  const isAccent = new Uint8Array(n)
  if (options.accent > 0)
    for (let i = 0; i < n; i++)
      isAccent[i] =
        Math.hypot((lab[i * 3 + 1] ?? 0) - meanA, (lab[i * 3 + 2] ?? 0) - meanB) > options.accent ? 1 : 0
  // A small accent share is noise in the photo, not a material: under 3% it stays on the surface's ladder.
  const share = isAccent.reduce((sum, v) => sum + v, 0) / n
  if (share < 0.03 || share > 0.6) isAccent.fill(0)
  const lights: [number[], number[]] = [[], []]
  for (let i = 0; i < n; i++) lights[isAccent[i] as 0 | 1].push(lab[i * 3] ?? 0)
  const mid = [median(lights[0]), median(lights[1])]
  for (let i = 0; i < n; i++) {
    const slot = isAccent[i] as 0 | 1
    const offset = Math.max(
      options.range[0],
      Math.min(options.range[1], Math.round(((lab[i * 3] ?? 0) - (mid[slot] ?? 0)) / options.contrast)),
    )
    out[i] = slot * 16 + offset + 8
  }
  return out
}

/** Photo mode: the photo's `k` main colours (k-means in OKLab, seeded from its lightness quantiles), snapped to DUEL;
 * each texel labelled with its colour's ramp and step. */
export function indexPhoto(src: Lab, k: number): Uint16Array {
  const { width, height, lab } = src
  const n = width * height
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => (lab[a * 3] ?? 0) - (lab[b * 3] ?? 0) || a - b,
  )
  const centres = Array.from({ length: k }, (_, j) => {
    const i = order[Math.min(n - 1, Math.floor(((j + 0.5) / k) * n))] ?? 0
    return [lab[i * 3] ?? 0, lab[i * 3 + 1] ?? 0, lab[i * 3 + 2] ?? 0]
  })
  const nearestCentre = new Int32Array(n)
  for (let round = 0; round < 8; round++) {
    const sums = centres.map(() => [0, 0, 0, 0])
    for (let i = 0; i < n; i++) {
      let best = Number.POSITIVE_INFINITY
      let bestJ = 0
      for (let j = 0; j < k; j++) {
        const c = centres[j] as number[]
        const e =
          ((lab[i * 3] ?? 0) - (c[0] ?? 0)) ** 2 +
          ((lab[i * 3 + 1] ?? 0) - (c[1] ?? 0)) ** 2 +
          ((lab[i * 3 + 2] ?? 0) - (c[2] ?? 0)) ** 2
        if (e < best) {
          best = e
          bestJ = j
        }
      }
      nearestCentre[i] = bestJ
      const s = sums[bestJ] as number[]
      s[0] = (s[0] ?? 0) + (lab[i * 3] ?? 0)
      s[1] = (s[1] ?? 0) + (lab[i * 3 + 1] ?? 0)
      s[2] = (s[2] ?? 0) + (lab[i * 3 + 2] ?? 0)
      s[3] = (s[3] ?? 0) + 1
    }
    sums.forEach((s, j) => {
      const count = s[3] ?? 0
      if (count > 0) centres[j] = [(s[0] ?? 0) / count, (s[1] ?? 0) / count, (s[2] ?? 0) / count]
    })
  }
  const labels = centres.map(([L, A, B]) => {
    const index = duelIndexOf(rgbFromLab(L ?? 0, A ?? 0, B ?? 0))
    return (2 + Math.floor(index / STEPS)) * 16 + (index % STEPS)
  })
  const out = new Uint16Array(n)
  for (let i = 0; i < n; i++) out[i] = labels[nearestCentre[i] as number] ?? 0
  return out
}

/** The wear field: smooth value noise over the tile, its value at each texel (0 to 1). The lattice has a whole number of
 * cells across each axis (about 6 texels a cell), so the field wraps with the tile and a worn wall shows no seam. */
export function wearField(width: number, height: number, seed: number): Float32Array {
  const out = new Float32Array(width * height)
  const cw = Math.max(1, Math.round(width / 6))
  const ch = Math.max(1, Math.round(height / 6))
  const corner = (i: number, j: number): number => hash3(wrap(i, cw), wrap(j, ch), seed)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const fx = (x * cw) / width
      const fy = (y * ch) / height
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const tx = fx - x0
      const ty = fy - y0
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      out[y * width + x] =
        (corner(x0, y0) * (1 - sx) + corner(x0 + 1, y0) * sx) * (1 - sy) +
        (corner(x0, y0 + 1) * (1 - sx) + corner(x0 + 1, y0 + 1) * sx) * sy
    }
  return out
}

/** Wear: patches of the surface a step darker (a label's value one down, never under `floor`) where the wear field is over
 * 1 - 0.45 * `amount` (0 to 1), so worn patches are clusters, never single texels. */
export function wear(
  labels: Uint16Array,
  width: number,
  height: number,
  amount: number,
  seed: number,
  floor = 0,
): void {
  if (amount <= 0) return
  const field = wearField(width, height, seed)
  for (let i = 0; i < width * height; i++)
    if ((field[i] ?? 0) > 1 - amount * 0.45 && ((labels[i] ?? 0) & 15) > floor)
      labels[i] = (labels[i] ?? 0) - 1
}

/** The clean-up: orphans take their neighbours' label, and clusters under `min` texels (4-connected, wrapping) join the
 * neighbour they border most. Run to a fixed point (at most a few passes). */
export function clean(labels: Uint16Array, width: number, height: number, min: number): void {
  const n = width * height
  const neighbours = (i: number): number[] => {
    const x = i % width
    const y = (i / width) | 0
    return [
      y * width + wrap(x - 1, width),
      y * width + wrap(x + 1, width),
      wrap(y - 1, height) * width + x,
      wrap(y + 1, height) * width + x,
    ]
  }
  /** The label most of `votes` name; the lowest on a tie. */
  const winner = (votes: Map<number, number>, fallback: number): [number, number] => {
    let best = fallback
    let most = 0
    for (const [label, count] of votes)
      if (count > most || (count === most && label < best)) {
        best = label
        most = count
      }
    return [best, most]
  }
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    // Orphans and single-texel spurs: a texel whose label at most one of its four neighbours shares takes the most
    // common label round it, if three or more agree.
    for (let i = 0; i < n; i++) {
      const around = neighbours(i).map((q) => labels[q] ?? 0)
      if (around.filter((l) => l === labels[i]).length > 1) continue
      const votes = new Map<number, number>()
      for (const l of around) votes.set(l, (votes.get(l) ?? 0) + 1)
      const [best, most] = winner(votes, labels[i] ?? 0)
      if (most >= 3 && best !== labels[i]) {
        labels[i] = best
        changed = true
      }
    }
    if (min > 1) {
      const seen = new Uint8Array(n)
      for (let start = 0; start < n; start++) {
        if (seen[start]) continue
        const label = labels[start]
        const run: number[] = []
        const stack = [start]
        seen[start] = 1
        while (stack.length > 0) {
          const i = stack.pop() as number
          run.push(i)
          for (const q of neighbours(i))
            if (!seen[q] && labels[q] === label) {
              seen[q] = 1
              stack.push(q)
            }
        }
        if (run.length >= min || run.length === n) continue
        const votes = new Map<number, number>()
        for (const i of run)
          for (const q of neighbours(i))
            if (labels[q] !== label) votes.set(labels[q] ?? 0, (votes.get(labels[q] ?? 0) ?? 0) + 1)
        const [best] = winner(votes, label ?? 0)
        if (best !== label) {
          for (const i of run) labels[i] = best
          changed = true
        }
      }
    }
    if (!changed) break
  }
}
