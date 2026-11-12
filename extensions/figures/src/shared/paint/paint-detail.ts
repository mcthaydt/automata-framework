// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 23 of the builders-fold plan (the strict flags) replaces each with a check

import { GROUP } from '../body/parts'
import { OUTLINE } from './paint-budget'
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
