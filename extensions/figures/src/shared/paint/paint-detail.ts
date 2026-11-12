// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check

import { GROUP, type Material } from '../body/parts'
import { smooth } from '../math/math'
import { isLeg, K2, LINE, MIRROR, MIRROR_SKY, OUTLINE, RIM } from './paint-budget'
import { FACE_SEAM } from './paint-style'
import type { AfterClusterTones } from './paint-tones'
import { noise3 } from './raster'

/**
 * The detail floor: a fleck of a part's material too small to read as a thing, in the middle of another's, is that
 * one's; a mark shorter than D + 1 texels with no shine of its own goes too. The head's and the skin's keep
 * theirs.
 */
export function detailFloor(ctx: AfterClusterTones) {
  const { D, group, h, hairy, handTone, material, materials, n, part, run, skin, stack, tone, under, w } = ctx
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
}

/**
 * The outline outside the figure (each empty texel beside it, owned by its nearest filled neighbour), the
 * selective outline on the silhouette (a shape's line toward the key and ink away from it, decided per run of the
 * contour, not per texel) and black's form: a cool rim inside a dark ramp's lit line and a welt on the key's side
 * of a fold.
 */
export function outlines(ctx: AfterClusterTones) {
  const { D, darkRamp, depth, filled, h, material, n, owner, part, run, skinny, stack, style, tone, w } = ctx
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
}

/**
 * A stain on fitted cloth (trousers) is a wash, as denim wears: a soft fade on the thighs' fronts and the knees,
 * with whiskers across the hip crease and the back of the knee; and iridescence, where a holo surface ranks its
 * texels by light and turn and lays its ramp over them in that order (a mirror's lens lit on the key's side, its
 * top row the sky).
 */
export function stainsAndHolo(ctx: AfterClusterTones) {
  const { D, P, group, lit, material, materials, n, part, ppm, sm, stains, tone, w } = ctx
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
  return { wash, hue, through }
}

/** The context once `stainsAndHolo` has run. */
export type AfterStainsAndHolo = AfterClusterTones & ReturnType<typeof stainsAndHolo>
