// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 23 of the builders-fold plan (the strict flags) replaces each with a check

import { GROUP } from '../body/parts'
import { K2, LINE, OUTLINE, RIM } from './paint-budget'
import { FACE_SEAM } from './paint-style'
import type { AfterClusterTones } from './paint-tones'

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
