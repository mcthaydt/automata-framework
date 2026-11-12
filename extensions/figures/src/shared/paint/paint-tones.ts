// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check

import { GROUP } from '../body/parts'
import {
  GLOSS_SHEEN,
  isLeg,
  K2,
  OUTLINE,
  RISE,
  SHEEN,
  SHEEN_MAX,
  SHEEN_MIN,
  sheenScale,
  touching,
} from './paint-budget'
import { FACE_SEAM, KEY, oklab } from './paint-style'
import type { AfterQuiltedBands } from './paint-surface'

/**
 * The gloss patches (a dark gloss's sheen, a glossy face's) and the tone of every texel: its crevice, its cast
 * shadow marched toward the key, its shine, and the outline's owner and its line, with the hands' own tones.
 */
export function toneTexels(ctx: AfterQuiltedBands) {
  const {
    D,
    band,
    depth,
    faceLight,
    filled,
    grains,
    group,
    h,
    handTone,
    isFace,
    lit,
    material,
    materials,
    n,
    part,
    ppm,
    skin,
    skinny,
    sm,
    style,
    surfaceOf,
    thOf,
    tones,
    w,
  } = ctx
  /** A dark, hard gloss (leather, patent, a black frame): its body stays dark, its light only a thin rim on the key's side
   * of its silhouette, its highlight one soft patch per surface (the sheen, above), not a streak along every crest. */
  const hard = materials.map(
    (m, i) => m.gloss !== undefined && !m.strands && i !== skin && oklab(tones[i][1])[0] < 0.4,
  )
  // Tones: 0 light … 3 deep, −1 a gloss's shine, −2 empty, OUTLINE and LINE. `owner` is the shape an outline texel
  // belongs to (the nearer one): its line tone and its normal.
  const tone = new Int8Array(n).fill(-2),
    owner = new Int32Array(n).fill(-1),
    under = new Int8Array(n).fill(2)
  const half = (() => {
    const v = [KEY[0], KEY[1], KEY[2] + 1],
      l = Math.hypot(...v)
    return v.map((c) => c / l)
  })()
  const spec = (k: number) => sm[k * 3] * half[0] + sm[k * 3 + 1] * half[1] + sm[k * 3 + 2] * half[2]
  // A glossy face's sheen: a few texels on the planes that mirror the key best (its top 4%, at most 3·D of them), never
  // a whole plane (its planes are flat, so a sheen by threshold would take one entire).
  let faceSheen = Infinity
  if (skin >= 0 && materials[skin].gloss !== undefined) {
    const ss: number[] = []
    for (let k = 0; k < n; k++) if (isFace(k)) ss.push(spec(k))
    ss.sort((a, b) => b - a)
    if (ss.length) faceSheen = ss[Math.min(ss.length - 1, Math.floor(Math.min(0.04 * ss.length, 3 * D)))]
  }
  // A dark gloss's sheen patch, per surface (a part in one material): the texels that mirror the key best, by the mirror term
  // (the texel's index breaks a tie, so a flat surface never takes whole). Marked here, before the tone loop reads it.
  const sheen = new Uint8Array(n)
  if (hard.some(Boolean)) {
    const bySurface = new Map<number, number[]>()
    for (let k = 0; k < n; k++)
      if (material[k] >= 0 && part[k] >= 0 && hard[material[k]]) {
        const key = surfaceOf(k)
        let a = bySurface.get(key)
        if (!a) {
          a = []
          bySurface.set(key, a)
        }
        a.push(k)
      }
    for (const [key, ks] of bySurface) {
      if (ks.length < SHEEN_MIN * D * D) continue
      const take = Math.min(
        Math.floor(GLOSS_SHEEN * materials[key % 4096].gloss! * ks.length * sheenScale(D)),
        Math.ceil(SHEEN_MAX * D * D * sheenScale(D)),
      )
      ks.sort((a, b) => spec(b) - spec(a) || a - b)
      for (let i = 0; i < Math.max(1, take); i++) sheen[ks[i]] = 1
    }
  }
  const maxShadow = Math.round(style.shadow * D)
  /** Within `D` rows under the face's skin: the jaw's own shadow band on the neck. */
  const underJaw = (x: number, y: number) => {
    for (let d = 1; d <= D; d++) if (y - d >= 0 && part[(y - d) * w + x] === FACE_SEAM) return true
    return false
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x,
        mi = material[k]
      if (mi < 0) continue
      const m = materials[mi]
      // Where another group passes in front: this, the far side, takes its outline; a nearer part beside: a crevice tone.
      let line = -1,
        crevice = false
      for (let i = 0; i < 4; i++) {
        const xx = x + (i === 0 ? -1 : i === 1 ? 1 : 0),
          yy = y + (i === 2 ? -1 : i === 3 ? 1 : 0)
        if (!filled(xx, yy)) continue
        const q = yy * w + xx
        if (part[q] === part[k] || (part[q] < 0 && part[q] !== -2)) continue
        const d = depth[q] - depth[k]
        // One garment over the trunk and the legs (trousers' seat and legs, in one cloth whatever its wash) is one
        // surface: no line where it crosses.
        const cloth =
          material[q] >= 0 &&
          tones[material[q]] === tones[mi] &&
          (isLeg(group[k]) ? group[q] === GROUP.torso : group[k] === GROUP.torso && isLeg(group[q]))
        if (group[q] !== group[k] && d > style.line && !cloth) {
          if (line < 0 || depth[q] > depth[line]) line = q
        }
        // Where two body regions only touch (an arm hanging against the ribs, the thighs, a hand on the leg), their
        // depths meet: the line runs down the contact, on whichever side sits behind, beside the other's flank (not over
        // a shoulder's or a hip's top, where one grows from the other).
        else if (
          i < 2 &&
          touching(group[k], group[q]) &&
          (d > 0 || (d === 0 && group[k] < group[q])) &&
          Math.abs(sm[k * 3 + 1]) < 0.35 &&
          Math.abs(sm[q * 3 + 1]) < 0.35
        ) {
          if (line < 0) line = q
        } else if (
          d > style.crevice &&
          !(band[k] > -9 && group[q] === group[k] && material[q] >= 0 && tones[material[q]] === tones[mi])
        )
          crevice = true
      }
      if (m.flat || part[k] === -2) {
        if (line >= 0 && part[k] !== -2) {
          tone[k] = OUTLINE
          owner[k] = line
          under[k] = 1
        } else tone[k] = 1
        continue
      }
      const f = lit[k],
        grain = grains[k],
        th = thOf(k)
      let t = band[k] > -9 ? band[k] : f > th[0] ? 0 : f > th[1] ? 1 : f > th[2] ? 2 : 3
      if (t === 1 && faceLight[k]) t = 0
      if (m.lift !== undefined && m.lift <= 0) t = Math.max(t, 1)
      // A chamber's stitch is its own last row: the next chamber beside it casts no crevice and no shadow on it.
      const quilted = band[k] > -9,
        stitch = (q: number) =>
          quilted && group[q] === group[k] && material[q] >= 0 && tones[material[q]] === tones[mi]
      if (crevice) t = Math.max(t, 2)
      // The cast shadow: march toward the key; a part of another surface standing above the ray's climb shades this one.
      // The head shades the neck in one band, `D` rows under the jaw's edge, never stacked deeper (a crevice and a cast
      // shadow piled under a short chin read as a beard).
      const neck = mi === skin && part[k] !== FACE_SEAM && group[k] === GROUP.head
      // The neck is the head's to shade: it sits under the jaw, never in the face's light.
      if (neck) t = Math.max(t, 1)
      for (let d = 1; d <= maxShadow; d++) {
        const xx = Math.round(x + K2[0] * d),
          yy = Math.round(y + K2[1] * d)
        if (!filled(xx, yy)) continue
        const q = yy * w + xx
        if (part[q] === part[k] || part[q] === -2) continue
        if ((neck && part[q] === FACE_SEAM && !underJaw(x, y)) || stitch(q)) continue
        if (depth[q] - depth[k] > style.shadowDepth + (RISE * d) / ppm) {
          t = Math.max(t, 2)
          break
        }
      }
      // A gloss mirrors the key where the surface faces halfway between it and the eye (the strands break it on hair): a
      // tight spot, tighter the glossier. A hard one: its shine only in the surface's sheen patch (above), where it mirrors the
      // key best, so a sleeve's is one soft highlight that holds its place from frame to frame.
      if (m.gloss !== undefined && t <= 1 && band[k] === -9) {
        const sk = spec(k)
        if (hard[mi]) {
          if (sheen[k] && sk > 1 - (1 - m.gloss) * 0.9) t = -1
        } else if (isFace(k) ? t === 0 && sk > faceSheen : sk + grain * 0.15 > 1 - (1 - m.gloss) * 0.6) t = -1
      }
      // An ear (a surface in the skin's own tones but not the skin): the skin's ramp, its rim the mid or the shadow (never
      // the light, nor a gloss's shine: the face's front is where the light lands) and its bowl the one shadow step inside
      // it, so at sprite size it reads as an ear, not a dark or a pale patch.
      if (skinny[mi] && mi !== skin && t !== OUTLINE) t = Math.max(1, Math.min(t, 2))
      // A line texel keeps the tone it would have had (`under`), should its line turn out a stray fleck.
      if (line >= 0) {
        tone[k] = OUTLINE
        owner[k] = line
        under[k] = Math.max(t, 2)
      } else if (handTone[k] === OUTLINE) {
        // A hand's divide or its contour over its own skin (paint-hands.ts drawHands): a line, drawn in ink.
        tone[k] = OUTLINE
        owner[k] = k
        under[k] = Math.max(t, 2)
      } else tone[k] = handTone[k] >= 0 ? handTone[k] : t
    }
  return { hard, tone, owner, under }
}

/** The context once `toneTexels` has run. */
export type AfterToneTexels = AfterQuiltedBands & ReturnType<typeof toneTexels>

/**
 * The tones as a pixel artist cleans them: a dark gloss's sheen drops a speck, the hair's sheen band rings the
 * crown where its surface turns from the top to the side, and a face texel that stands out of its plane takes its
 * neighbours' tone.
 */
export function polishTones(ctx: AfterToneTexels) {
  const {
    D,
    band,
    faceLight,
    grains,
    h,
    hairy,
    hard,
    isFace,
    material,
    materials,
    n,
    part,
    sm,
    surfaceOf,
    tone,
    w,
  } = ctx
  // A dark gloss's sheen keeps no speck: a patch that a shadow or the surface's edge cut down to a few texels is dropped (the
  // surface reads in its mid tone there), as a sprite artist would not leave an orphan highlight. A quilted chamber's crest
  // (`band`) is a line, not a patch: it stays whatever its length.
  if (hard.some(Boolean)) {
    const seen = new Uint8Array(n),
      least = Math.ceil((SHEEN_MIN * D * D * sheenScale(D)) / 4)
    for (let k = 0; k < n; k++) {
      if (tone[k] !== -1 || seen[k] || !hard[material[k]] || band[k] > -9) continue
      const area = [k]
      seen[k] = 1
      for (let i = 0; i < area.length; i++)
        for (const q of [area[i] - 1, area[i] + 1, area[i] - w, area[i] + w]) {
          if (
            q >= 0 &&
            q < n &&
            !seen[q] &&
            tone[q] === -1 &&
            band[q] === -9 &&
            surfaceOf(q) === surfaceOf(k)
          ) {
            seen[q] = 1
            area.push(q)
          }
        }
      if (area.length < least) for (const q of area) tone[q] = 1
    }
  }
  // The hair's sheen band, as a sprite artist paints glossy hair: a ring of the hair's shine round the crown where its
  // surface turns from the top to the side (its normal's rise in a narrow window), broken where the strands part it, on
  // the key's side brighter (its shine) and on the far side its light; never on locks hanging down (a tail, a fringe's
  // fall), which do not rise. Glossy hair alone (a straight or sleek finish, or strands): coils, braids and locs are matte.
  for (let k = 0; k < n; k++) {
    const mi = material[k]
    if (
      mi < 0 ||
      !hairy(part[k]) ||
      !(materials[mi].sheen || materials[mi].strands) ||
      tone[k] < 0 ||
      tone[k] > 2
    )
      continue
    const nx = sm[k * 3],
      ny = sm[k * 3 + 1],
      nz = sm[k * 3 + 2]
    if (nz < 0.05 || ny < SHEEN[0]) continue
    // Over the band the crown sits a tone down, in the mid, so the ring reads as a ring and not as the top lit whole.
    if (ny > SHEEN[1]) {
      tone[k] = Math.max(tone[k], 1)
      continue
    }
    if (grains[k] < -0.18) continue
    tone[k] = nx * K2[0] >= -0.2 ? -1 : 0
  }
  // The face's tones as a pixel artist cleans them: a texel standing out of its plane (five of its eight neighbours one
  // other tone: a spur, a fleck, a notch in an edge) takes that tone, so its planes meet in clean edges and its shapes
  // keep their size (the drawn face puts its own marks on after). A front plane's light (LIGHT) is a shape drawn on
  // purpose, the bridge's a line: it stays.
  for (let pass = 0; pass < 2; pass++) {
    const was = tone.slice()
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const k = y * w + x
        if (!isFace(k) || was[k] < 0 || was[k] > 3 || (was[k] === 0 && faceLight[k])) continue
        const count = [0, 0, 0, 0]
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const q = k + dy * w + dx
            if ((dx || dy) && isFace(q) && was[q] >= 0 && was[q] <= 3) count[was[q]]++
          }
        let best = was[k]
        for (let i = 0; i < 4; i++) if (count[i] > count[best]) best = i
        if (best !== was[k] && count[best] >= 5 && count[was[k]] <= 2) tone[k] = best
      }
  }
}

/**
 * Lines run whole: a gap of a texel or two along a line inside the figure closes, a stray fleck of line goes back
 * to its shadow tone, and a deep texel on the shadow side's edge lifts to shadow as reflected light, so the form
 * turns before its line.
 */
export function ruleLines(ctx: AfterToneTexels) {
  const { D, filled, h, material, n, owner, part, style, tone, under, w } = ctx
  // Lines run whole: a gap of a texel or two along a line inside the figure (where the contact flickers along a flank)
  // closes, between line texels on one surface drawn for one nearer part, so no line breaks into dashes.
  const lineOn = (q: number, k: number) =>
    q >= 0 && q < n && tone[q] === OUTLINE && material[q] >= 0 && part[q] === part[k]
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const k = y * w + x
      if (material[k] < 0 || tone[k] === OUTLINE || tone[k] === -2) continue
      for (const d of [1, w, w + 1, w - 1]) {
        // The line's ends either side, one of them next to this texel.
        const a = lineOn(k - d, k) ? k - d : lineOn(k - 2 * d, k) ? k - 2 * d : -1,
          b = lineOn(k + d, k) ? k + d : lineOn(k + 2 * d, k) ? k + 2 * d : -1
        if (a < 0 || b < 0 || (a !== k - d && b !== k + d) || part[owner[a]] !== part[owner[b]]) continue
        under[k] = Math.max(tone[k], 2)
        tone[k] = OUTLINE
        owner[k] = owner[a]
        break
      }
    }
  // Stray flecks of line: an interior line still of fewer than a few texels (8-connected, not running into the outline
  // outside) is where two forms only graze; it goes back to its shadow tone whole.
  const minLine = 2 + D,
    lineSeen = new Uint8Array(n),
    lineRun: number[] = [],
    stack: number[] = []
  for (let s0 = 0; s0 < n; s0++) {
    if (lineSeen[s0] || tone[s0] !== OUTLINE || material[s0] < 0) continue
    lineRun.length = 0
    stack.push(s0)
    lineSeen[s0] = 1
    let outside = false
    while (stack.length) {
      const k = stack.pop()!
      lineRun.push(k)
      const x = k % w,
        y = (k - x) / w
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy
          if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          const q = yy * w + xx
          if (material[q] < 0) {
            outside = true
            continue
          }
          if (tone[q] === OUTLINE && !lineSeen[q]) {
            lineSeen[q] = 1
            stack.push(q)
          }
        }
    }
    if (!outside && lineRun.length < minLine)
      for (const k of lineRun) {
        tone[k] = under[k]
        owner[k] = -1
      }
  }
  // Reflected light: a deep texel on the shadow side's edge (beside the outside, or the line on a far part, away from
  // the key) lifts to shadow, so the form turns before its line and the two darks never double.
  const edgeAt = (x: number, y: number) => !filled(x, y) || tone[y * w + x] === OUTLINE
  if (style.bounce)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if (tone[k] !== 3) continue
        const away = edgeAt(x + 1, y) || edgeAt(x, y + 1),
          toward = edgeAt(x - 1, y) || edgeAt(x, y - 1)
        if (away && !toward && (tone[k - 1] === 3 || tone[k - w] === 3)) tone[k] = 2
      }
  return { stack }
}

/** The context once `ruleLines` has run. */
export type AfterRuleLines = AfterToneTexels & ReturnType<typeof ruleLines>

/**
 * The clusters, as a pixel artist cleans them: a run of one tone in one part smaller than the cluster size takes
 * the tone its edge touches most (a shine keeps any run of two, a face's plane its light from a run of D, at least
 * two), a dark gloss's shine staying within its patch's cap.
 */
export function clusterTones(ctx: AfterRuleLines) {
  const { D, faceLight, h, handTone, hard, material, materials, n, part, stack, style, surfaceOf, tone, w } =
    ctx
  // The clusters, as a pixel artist cleans them: a run of one tone in one part smaller than the cluster size takes the
  // tone its edge touches most (a shine keeps any run of two, a face's plane its light from a run of D, at least two).
  const minSize = style.cluster * D * D,
    seen = new Uint8Array(n),
    run: number[] = [],
    votes = new Int32Array(16)
  const shineCap = Math.ceil(SHEEN_MAX * D * D * sheenScale(D)),
    shineOf = new Map<number, number>()
  for (let k = 0; k < n; k++)
    if (tone[k] === -1 && material[k] >= 0 && hard[material[k]]) {
      const key = surfaceOf(k)
      shineOf.set(key, (shineOf.get(key) ?? 0) + 1)
    }
  for (let s0 = 0; s0 < n; s0++) {
    const t0 = tone[s0]
    if (
      seen[s0] ||
      t0 < -1 ||
      t0 >= OUTLINE ||
      part[s0] === -2 ||
      materials[material[s0]].flat ||
      handTone[s0] >= 0
    )
      continue
    run.length = 0
    stack.push(s0)
    seen[s0] = 1
    votes.fill(0)
    while (stack.length) {
      const k = stack.pop()!
      run.push(k)
      const x = k % w,
        y = (k - x) / w
      for (let i = 0; i < 4; i++) {
        const q =
          i === 0
            ? x > 0
              ? k - 1
              : -1
            : i === 1
              ? x < w - 1
                ? k + 1
                : -1
              : i === 2
                ? y > 0
                  ? k - w
                  : -1
                : y < h - 1
                  ? k + w
                  : -1
        if (q < 0 || material[q] !== material[s0] || part[q] !== part[s0]) continue
        if (tone[q] === t0 && handTone[q] < 0) {
          if (!seen[q]) {
            seen[q] = 1
            stack.push(q)
          }
        } else if (tone[q] >= -1 && tone[q] < OUTLINE) votes[tone[q] + 1]++
      }
    }
    if (
      run.length >= (t0 === -1 ? Math.min(2, minSize) : t0 === 0 && faceLight[s0] ? Math.max(2, D) : minSize)
    )
      continue
    let best = t0,
      most = 0
    // (A dark gloss's shine stays within its patch's cap: a fleck beside the patch joins it only while the surface is under.)
    const gain = hard[material[s0]] && t0 !== -1 ? (shineOf.get(surfaceOf(s0)) ?? 0) : -Infinity
    for (let i = 0; i < 5; i++)
      if (votes[i] > most && (i > 0 || gain + run.length <= shineCap)) {
        most = votes[i]
        best = i - 1
      }
    if (best !== t0) {
      for (const k of run) tone[k] = best
      if (hard[material[s0]]) {
        const key = surfaceOf(s0)
        shineOf.set(
          key,
          (shineOf.get(key) ?? 0) + (best === -1 ? run.length : 0) - (t0 === -1 ? run.length : 0),
        )
      }
    }
  }
  return { run }
}

/** The context once `clusterTones` has run. */
export type AfterClusterTones = AfterRuleLines & ReturnType<typeof clusterTones>
