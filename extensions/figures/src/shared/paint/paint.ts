// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 23 of the builders-fold plan (the strict flags) replaces each with a check

import { GROUP, type Material } from '../body/parts'
import { smooth } from '../math/math'
import { depthAt, labelAt, type Weave } from './fabric'
import {
  budget,
  isLeg,
  K2,
  LINE,
  lightTexels,
  MIRROR,
  MIRROR_SKY,
  OUTLINE,
  RIM,
  SHEEN_MAX,
  sheenScale,
  tint,
} from './paint-budget'
import type { FaceStamp } from './paint-face'
import type { Bends, HandStamp } from './paint-hands'
import type { Cloth } from './paint-prepare'
import { type PaintInputs, prepare } from './paint-prepare'
import { stampFace } from './paint-stamp'
import { EDGE_LEVELS, FACE_SEAM, PAINT, type PaintStyle } from './paint-style'
import { faceForm, keyLight, quiltedBands, smoothSurfaces } from './paint-surface'
import { polishTones, toneTexels } from './paint-tones'
import { type GBuffer, noise3 } from './raster'
import { tiled } from './row'

export {
  densityOf,
  familyTones,
  GLOSS_SHEEN,
  SHEEN_MAX,
  SHEEN_MIN,
  sheenScale,
} from './paint-budget'
export type { FaceStamp } from './paint-face'
export { eyeWhite } from './paint-face'
export type { Bends, HandStamp } from './paint-hands'
export type { PaintStyle } from './paint-style'
export { duel, FACE_SEAM, oklab, PAINT, rampOf, tonesOf } from './paint-style'

/**
 * Paints the cell: `albedo` (RGBA) and `normals` (RGBA, red right, green down, blue toward the camera). `skin` is the
 * skin's material (it takes no cloth folds), −1 for none.
 *
 * - The outline sits just outside each shape (an empty texel beside the figure, or a far surface's texel beside a nearer
 *   part of another group), one texel and 8-connected, so a form keeps its width and a thin wrist keeps its colour. On
 *   the silhouette it is selective: toward the key, the shape's own line tone; away from it and underneath, ink. Inside
 *   the figure it is the far surface's own fold, and it runs whole or not at all.
 * - The key light on normals smoothed over each surface (a wider brush at higher density), cut into clusters: a tone
 *   island smaller than `cluster` joins its neighbours. Cloth's terminator wanders with its folds.
 * - Form: a crevice tone where a nearer part sits beside, a cast shadow where one stands between the surface and the key,
 *   reflected light on the shadow side's edge, and a glossy material's shine where it mirrors the key.
 */
export function paint(
  g: GBuffer,
  materials: Material[],
  albedo: Uint8ClampedArray,
  normals: Uint8ClampedArray,
  face: FaceStamp | null,
  style: PaintStyle = PAINT,
  skin = face?.skin ?? -1,
  hands: HandStamp[] = [],
  bends: Bends = {},
  light?: Float32Array,
  cloth?: Cloth,
  weaveOut?: Weave,
): { albedo: Uint8ClampedArray; normals: Uint8ClampedArray; weave: Weave | null } {
  const c0: PaintInputs = {
    g,
    materials,
    albedo,
    normals,
    face,
    style,
    skin,
    hands,
    bends,
    light,
    cloth,
    weaveOut,
  }
  const c1 = { ...c0, ...prepare(c0) }
  const c2 = { ...c1, ...smoothSurfaces(c1) }
  const c3 = { ...c2, ...faceForm(c2) }
  const c4 = { ...c3, ...keyLight(c3) }
  const c5 = { ...c4, ...quiltedBands(c4) }
  const c6 = { ...c5, ...toneTexels(c5) }
  polishTones(c6)
  // @cut-head-end: the names below are what the statements still in paint() read of the phases cut so far
  const {
    D,
    P,
    darkRamp,
    depth,
    edges,
    extra,
    fabrics,
    faceLight,
    filled,
    group,
    h,
    hairy,
    handTone,
    hard,
    ink,
    lit,
    material,
    n,
    owner,
    part,
    ppm,
    skinny,
    slotOf,
    sm,
    stains,
    surfaceOf,
    tone,
    tones,
    under,
    w,
    weave,
  } = c6
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
  for (let k = 0; k < n; k++) {
    const o = k * 4,
      t = tone[k]
    if (t === -2) {
      albedo[o + 3] = 0
      normals[o] = 128
      normals[o + 1] = 128
      normals[o + 2] = 255
      normals[o + 3] = 0
      continue
    }
    // A line inside the figure is the far surface's own (its fold, its normal); one outside, its shape's.
    const at = t >= OUTLINE && material[k] < 0 ? owner[k] : k,
      mi = material[at]
    let ramp = tones[mi]
    // Sheer cloth is denser where it turns from the eye: the share's level from how far this texel's normal is from facing it.
    const sheer = edges[mi]
    if (sheer && t < OUTLINE)
      ramp = sheer[Math.round((EDGE_LEVELS - 1) * (1 - Math.max(0, sm[at * 3 + 2])) ** 2)]
    const stain = materials[mi].stain
    let tt: number = t
    if (stain && t < OUTLINE) {
      const q = k * 3,
        up = (P[q + 1] - stain.hem) / (stain.below - stain.hem),
        gr = group[k]
      if (isLeg(gr) || gr === GROUP.torso) {
        const worn = isLeg(gr) ? wash(k, up, stain) : 0
        if (worn) {
          ramp = stains[mi]!
          tt = worn === 3 ? Math.max(Math.min(t, 3) - 1, 0) : t
        }
        // On hanging cloth (a skirt's hem): surely at the hem, ever less often up to its top, in runs that climb (noise
        // tall in y, fine across), on the cloth's own surface so it never swims.
      } else if (up < 1 && noise3(P[q] * 34, P[q + 1] * 5, P[q + 2] * 34) > Math.max(0, up) ** 0.7 * 0.85)
        ramp = stains[mi]!
    }
    if (hue[k] >= MIRROR) {
      ramp = tint(ramp)
      tt = hue[k] - MIRROR
    } else if (hue[k] >= 0) tt = hue[k]
    // Lit from outside: the key's bands are gone, so a light or dark key tone reads mid (3 deep stays).
    else if (light && t >= 0 && t <= 2) tt = 1
    // A fabric's tile (H5): a step along the material's own ramp by the tile's label, on cloth's own surface only. Not shine,
    // a line, the rim or the outline; not a holo hue, a mark or a print, a hand, or a texel the painter refilled (the
    // cloth channel follows the raster's surface, not the painter's copy). The head and held items have no cylinder.
    const fab = fabrics[mi]
    if (
      fab &&
      t >= 0 &&
      t <= 3 &&
      hue[k] < 0 &&
      at === k &&
      part[k] >= 0 &&
      part[k] === g.part[k] &&
      material[k] === g.material[k] &&
      handTone[k] < 0
    ) {
      let u = cloth!.u(group[k], cloth!.place[k * 3], cloth!.place[k * 3 + 1])
      // A handed tile (fabric.ts): the left limbs' `u` runs against the trunk's and the right limbs', so it is read negated.
      if (u !== null && fab.handed && (group[k] === GROUP.armL || group[k] === GROUP.legL)) u = -u
      if (u !== null) {
        weave!.labels[k] = labelAt(fab, u, cloth!.place[k * 3 + 2], ppm)
        weave!.on[k] = slotOf[mi]
      }
    }
    if (materials[mi].see && t < OUTLINE && (hue[k] >= MIRROR || materials[mi].holo !== 'mirror'))
      through.set(k, tint(tones[mi]))
    const c =
      t === OUTLINE
        ? at === k
          ? extra[mi].fold
          : ink
        : t === LINE
          ? extra[mi].line
          : t === RIM
            ? extra[mi].rim
            : t === -1
              ? extra[mi].shine
              : ramp[Math.min(tt, ramp.length - 1)]
    albedo[o] = (c >> 16) & 255
    albedo[o + 1] = (c >> 8) & 255
    albedo[o + 2] = c & 255
    albedo[o + 3] = 255
    normals[o] = Math.round((sm[at * 3] + 1) * 127.5)
    normals[o + 1] = Math.round((1 - sm[at * 3 + 1]) * 127.5)
    normals[o + 2] = Math.round((sm[at * 3 + 2] + 1) * 127.5)
    normals[o + 3] = 255
  }
  // The face reads the tones: an outline texel (9) is never the face's.
  const fixed = tone.map((v) => (v >= OUTLINE ? 9 : v))
  const kept = new Uint8Array(n)
  for (let k = 0; k < n; k++) if (tone[k] === -1 || hue[k] >= 0) kept[k] = 1
  if (face)
    stampFace(
      face,
      { ...g, material, part, group, depth },
      tones[face.skin],
      albedo,
      fixed,
      through,
      kept,
      (m) => skinny[m],
    )
  budget(albedo, w, h, D, kept, (k: number) => material[tone[k] >= OUTLINE && material[k] < 0 ? owner[k] : k])
  if (light) lightTexels(light, g, albedo, D)
  if (weave) {
    // The tile, last: the ground as painted, budgeted and lit, then a step along its own row by the label (row.ts tiled).
    weave.ground.set(albedo)
    for (let k = 0; k < n; k++) {
      if (!weave.on[k]) continue
      const o = k * 4,
        c = tiled(
          (albedo[o] << 16) | (albedo[o + 1] << 8) | albedo[o + 2],
          weave.labels[k],
          ...depthAt(weave, k),
        )
      albedo[o] = (c >> 16) & 255
      albedo[o + 1] = (c >> 8) & 255
      albedo[o + 2] = c & 255
    }
  }
  return { albedo, normals, weave }
}
