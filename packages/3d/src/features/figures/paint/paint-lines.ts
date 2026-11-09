import { hypot } from '@automata/sim/math'
import { smooth } from '../../../shared/math/math.ts'
import { noise3 } from '../../../shared/math/noise.ts'
import { GROUP } from '../body/mesh.ts'
import type { PainterMaterial } from '../figure/materials.ts'
import { FACE_SEAM } from './face-plane.ts'
import type { OutlinesOut, State6, State7, WashAndHoloOut } from './paint-state.ts'
import { K2, LINE, MIRROR, MIRROR_SKY, OUTLINE, RIM } from './paint-style.ts'
import { isLeg } from './regions.ts'
import { must } from './vec.ts'
/** Detail islands, the outline outside the figure, the selective silhouette and black's form. */
export function outlines(s: State6): OutlinesOut {
  const {
    materials,
    skin,
    style,
    D,
    darkRamp,
    depth,
    filled,
    group,
    h,
    hairy,
    handTone,
    material,
    n,
    part,
    skinny,
    w,
    owner,
    tone,
    under,
    run,
    stack,
  } = s

  // The detail floor: a fleck of a part's material too small to read as a thing (under 2·D² texels: a heel tab's tip
  // under a hem, a strap's end) in the middle of another's (three quarters of what it touches) is that one's; a mark
  // shorter than D + 1 texels (a woven tag's corner) with no shine of its own goes too. The head's (a stud, a tie) and
  // the skin's keep theirs: an accent there is the face's.
  {
    const islandSeen = new Uint8Array(n),
      around = new Map<number, number>()
    for (let s0 = 0; s0 < n; s0++) {
      const m0 = material[s0] ?? Number.NaN
      if (
        (islandSeen[s0] ?? Number.NaN) ||
        m0 < 0 ||
        m0 === skin ||
        (handTone[s0] ?? Number.NaN) >= 0 ||
        (group[s0] ?? Number.NaN) === GROUP.head ||
        hairy(part[s0] ?? Number.NaN) ||
        (part[s0] ?? Number.NaN) === FACE_SEAM
      )
        continue
      const mark = (part[s0] ?? Number.NaN) === -2
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
          if (q < 0 || (material[q] ?? Number.NaN) < 0) continue
          // A part's fleck is one material; a mark's, every mark it touches (a chain's links alternate their metals).
          if (
            mark
              ? (part[q] ?? Number.NaN) === -2
              : (material[q] ?? Number.NaN) === m0 && (part[q] ?? Number.NaN) !== -2
          ) {
            if (!(islandSeen[q] ?? Number.NaN)) {
              islandSeen[q] = 1
              stack.push(q)
            }
          } else around.set(q, material[q] ?? Number.NaN)
        }
      }
      if (
        run.length >= (mark ? D + 1 : 2 * D * D) ||
        (mark && run.some((k) => must(materials, material[k] ?? Number.NaN).gloss !== undefined))
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
        part[k] = part[host] ?? Number.NaN
        group[k] = group[host] ?? Number.NaN
        if ((tone[k] ?? Number.NaN) !== OUTLINE)
          tone[k] =
            (tone[host] ?? Number.NaN) === OUTLINE ? (under[host] ?? Number.NaN) : (tone[host] ?? Number.NaN)
      }
    }
  }
  // The outline outside the figure: each empty texel beside it, owned by its nearest filled neighbour.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if ((material[k] ?? Number.NaN) >= 0) continue
      let best = -1
      for (let i = 0; i < 4; i++) {
        const xx = x + (i === 0 ? -1 : i === 1 ? 1 : 0),
          yy = y + (i === 2 ? -1 : i === 3 ? 1 : 0)
        if (filled(xx, yy) && (best < 0 || (depth[yy * w + xx] ?? Number.NaN) > (depth[best] ?? Number.NaN)))
          best = yy * w + xx
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
    const outlined = (q: number) => (tone[q] ?? Number.NaN) === OUTLINE || (tone[q] ?? Number.NaN) === LINE
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if ((tone[k] ?? Number.NaN) !== OUTLINE || (material[k] ?? Number.NaN) >= 0) continue
        const ownPart = part[owner[k] ?? Number.NaN] ?? Number.NaN
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
              (material[q] ?? Number.NaN) >= 0 &&
              (part[q] ?? Number.NaN) === ownPart &&
              (tone[q] ?? Number.NaN) < OUTLINE
            ) {
              const r2 = dx * dx + dy * dy
              gx += dx / r2
              gy += dy / r2
            }
          }
        const l = hypot(gx, gy)
        score[k] = l > 0 ? -(gx * K2[0] + gy * K2[1]) / l : 0
      }
    // Along the contour: the mean over the outline of the same shape within W.
    const along = new Float32Array(n).fill(NaN)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if (Number.isNaN(score[k])) continue
        const ownPart = part[owner[k] ?? Number.NaN] ?? Number.NaN
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
              (part[owner[q] ?? Number.NaN] ?? Number.NaN) === ownPart
            ) {
              s += score[q] ?? Number.NaN
              c++
            }
          }
        along[k] = s / c
        if (along[k] > 0.3) tone[k] = LINE
      }
    // Runs: a short run of line between ink (or of ink between line) along one shape's contour takes the other.
    const runSeen = new Uint8Array(n)
    for (let s0 = 0; s0 < n; s0++) {
      if ((runSeen[s0] ?? Number.NaN) || Number.isNaN(along[s0])) continue
      const t0 = tone[s0] ?? Number.NaN,
        ownPart = part[owner[s0] ?? Number.NaN] ?? Number.NaN
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
              (part[owner[q] ?? Number.NaN] ?? Number.NaN) !== ownPart ||
              !outlined(q)
            )
              continue
            if ((tone[q] ?? Number.NaN) !== t0) other = true
            else if (!(runSeen[q] ?? Number.NaN)) {
              runSeen[q] = 1
              stack.push(q)
            }
          }
      }
      // A bare hand's or limb's run is shorter (its lit edge is the skin's line, never ink round a small form).
      if (
        other &&
        run.length < ((skinny[material[owner[s0] ?? Number.NaN] ?? Number.NaN] ?? false) ? D + 1 : minRun)
      )
        for (const k of run) tone[k] = t0 === LINE ? OUTLINE : LINE
    }
  }
  // Black's form: on a dark ramp the edge inside its lit line is a cool rim (its line alone is as dark as ink), and the
  // texel on the key's side of a fold (ink, a step under its deep) a welt two steps up, so a lapel, a yoke or a sleeve
  // reads as a raised edge over its shadow.
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const k = y * w + x,
        mi = material[k] ?? Number.NaN
      if (mi < 0 || !(darkRamp[mi] ?? false)) continue
      if ((tone[k] ?? Number.NaN) >= 0 && (tone[k] ?? Number.NaN) <= 2) {
        for (const q of [k - 1, k + 1, k - w, k + w])
          if (
            (material[q] ?? Number.NaN) < 0 &&
            (tone[q] ?? Number.NaN) === LINE &&
            (part[owner[q] ?? Number.NaN] ?? Number.NaN) === (part[k] ?? Number.NaN)
          ) {
            tone[k] = RIM
            break
          }
      } else if ((tone[k] ?? Number.NaN) === OUTLINE) {
        for (const q of [K2[0] < 0 ? k - 1 : k + 1, K2[1] < 0 ? k - w : k + w])
          if (
            (material[q] ?? Number.NaN) >= 0 &&
            (darkRamp[material[q] ?? Number.NaN] ?? false) &&
            (tone[q] ?? Number.NaN) >= 0 &&
            (tone[q] ?? Number.NaN) <= 3
          )
            tone[q] = Math.max(0, (tone[q] ?? Number.NaN) - 2)
      }
    }
  return {}
}

/** Stains on fitted cloth, and iridescence. */
export function washAndHolo(s: State7): WashAndHoloOut {
  const { materials, D, group, material, n, part, ppm, sm, stains, w, lit, P, tone } = s

  // A stain on fitted cloth (trousers) is a wash, as denim wears: a soft fade on the thighs' fronts and the knees (never
  // the seat, where it would pillow each cheek), an ellipse centred a little below the stain's start and gone by its
  // end, the wash's ramp at the cloth's own tone (no darker ring at its edge), so it fades and never drips; whiskers,
  // short level strokes a texel thick a texel apart, across the hip crease (slanting down and out from the crotch) and
  // the back of the knee, a tone lighter than the cloth around them. 0 none, 1 the edge, 2 the core, 3 a whisker.
  const centre = new Map<number, number>()
  if (stains.some(Boolean)) {
    const sum = new Map<number, [number, number]>()
    for (let k = 0; k < n; k++)
      if ((material[k] ?? Number.NaN) >= 0 && must(stains, material[k] ?? Number.NaN)) {
        const a = sum.get(part[k] ?? Number.NaN) ?? [0, 0]
        a[0] += P[k * 3] ?? Number.NaN
        a[1]++
        sum.set(part[k] ?? Number.NaN, a)
      }
    for (const [p, [sx, c]] of sum) centre.set(p, sx / c)
  }
  const wash = (k: number, up: number, stain: NonNullable<PainterMaterial['stain']>) => {
    const q = k * 3,
      leg = isLeg(group[k] ?? Number.NaN),
      z = P[q + 2] ?? Number.NaN,
      run = stain.hem - stain.below
    const facing = smooth(((leg ? z : -z) - 0.015) / 0.05),
      side = (group[k] ?? Number.NaN) === GROUP.legL ? 1 : -1
    // `along` runs outward from the leg's middle; on the seat, from the middle of either side of it.
    const dx = (P[q] ?? Number.NaN) - (centre.get(part[k] ?? Number.NaN) ?? P[q] ?? Number.NaN),
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
        return (
          at - row < 0.34 &&
          noise3(row * 1.7 + salt, (along * ppm) / 7, (part[k] ?? Number.NaN) * 0.37) > odds
        )
      }
      if (
        stroke(
          (P[q + 1] ?? Number.NaN) - stain.hem + 0.35 * along,
          up > 0.22 && up < 0.6 && facing > 0.3 && along < 0.03,
          0,
          0.47,
        )
      )
        return 3
      const knee = stain.below - 0.26 * run
      if (
        stroke(
          (P[q + 1] ?? Number.NaN) - knee,
          Math.abs((P[q + 1] ?? Number.NaN) - knee) < 0.04 && smooth(-z / 0.04) > 0.5,
          11,
          0.56,
        )
      )
        return 3
    }
    const s =
      v * facing +
      (noise3((P[q] ?? Number.NaN) * 9, (P[q + 1] ?? Number.NaN) * 6, (P[q + 2] ?? Number.NaN) * 9) - 0.5) *
        0.4
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
      const mi = material[k] ?? Number.NaN
      if (
        mi < 0 ||
        !must(materials, mi).holo ||
        (tone[k] ?? Number.NaN) < 0 ||
        (tone[k] ?? Number.NaN) >= OUTLINE
      )
        continue
      const key = (part[k] ?? Number.NaN) >= 0 ? (part[k] ?? Number.NaN) * 4096 + mi : -1 - mi
      let a = by.get(key)
      if (!a) {
        a = []
        by.set(key, a)
      }
      a.push(k)
    }
    const phase = (k: number) =>
      (lit[k] ?? Number.NaN) + 0.6 * (sm[k * 3] ?? Number.NaN) - 0.3 * (sm[k * 3 + 1] ?? Number.NaN)
    for (const ks of by.values()) {
      ks.sort((a, b) => phase(b) - phase(a))
      if (must(materials, material[ks[0] ?? Number.NaN] ?? Number.NaN).holo !== 'mirror') {
        ks.forEach((k, i) => {
          hue[k] = Math.max(
            Math.min(3, Math.floor((i / ks.length) * 4)),
            (tone[k] ?? Number.NaN) >= 2 ? 2 : 0,
          )
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
          for (const q of [
            (lens[i] ?? Number.NaN) - 1,
            (lens[i] ?? Number.NaN) + 1,
            (lens[i] ?? Number.NaN) - w,
            (lens[i] ?? Number.NaN) + w,
          ])
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
        const glint = (top[0] ?? Number.NaN) + w
        if (top.length && mine.has(glint) && lens.length >= 6 * D) hue[glint] = 0
      }
    }
  }
  return { wash, hue, through }
}
