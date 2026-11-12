// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 23 of the builders-fold plan (the strict flags) replaces each with a check

import { GROUP, type Material } from '../body/parts'
import { RAMP_OUTLINE, RAMPS } from './duel-ramps'
import { DUEL, duel, duelLab, EDGE_LEVELS, hex, INK, KEY, mixTones, oklab } from './paint-style'
import type { GBuffer } from './raster'
/**
 * The outside light: each coloured texel's albedo times the light there, snapped to DUEL. A texel the painter filled (no
 * material in g: the neck under the jaw, a designed hand) takes the mean light of the filled texels within 2·D, else the
 * whole figure's. Outline and ink stay as they are.
 */
export function lightTexels(light: Float32Array, g: GBuffer, albedo: Uint8ClampedArray, D: number) {
  const { w, h, material } = g,
    mean = [0, 0, 0]
  let total = 0
  for (let k = 0; k < w * h; k++)
    if (material[k] >= 0) {
      for (let i = 0; i < 3; i++) mean[i] += light[k * 3 + i]
      total++
    }
  for (let i = 0; i < 3; i++) mean[i] /= total || 1
  const near = (x: number, y: number) => {
    const sum = [0, 0, 0]
    let n = 0
    for (let yy = Math.max(0, y - 2 * D); yy <= Math.min(h - 1, y + 2 * D); yy++)
      for (let xx = Math.max(0, x - 2 * D); xx <= Math.min(w - 1, x + 2 * D); xx++) {
        const q = yy * w + xx
        if (material[q] >= 0) {
          for (let i = 0; i < 3; i++) sum[i] += light[q * 3 + i]
          n++
        }
      }
    return n ? sum.map((v) => v / n) : mean
  }
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  for (let k = 0; k < w * h; k++) {
    const o = k * 4,
      c = (albedo[o] << 16) | (albedo[o + 1] << 8) | albedo[o + 2]
    if (!albedo[o + 3] || c === 0 || c === INK_RGB || c === RAMP_OUTLINE) continue
    const L = material[k] >= 0 ? [light[k * 3], light[k * 3 + 1], light[k * 3 + 2]] : near(k % w, (k / w) | 0)
    const lit = duel(
      (byte(albedo[o] * L[0]) << 16) | (byte(albedo[o + 1] * L[1]) << 8) | byte(albedo[o + 2] * L[2]),
    )
    albedo[o] = (lit >> 16) & 255
    albedo[o + 1] = (lit >> 8) & 255
    albedo[o + 2] = lit & 255
  }
}
/** A sheer material's tones at each of its edge levels (index 0 is `tonesOf(m)` filled as the painter fills it), or null
 * for a material with no edge. The painter picks the level of a texel from how far it turns from the eye. */
export function edgeTonesOf(m: Material, cool: number): number[][] | null {
  const mix = m.mix
  if (!mix?.edge) return null
  return Array.from({ length: EDGE_LEVELS }, (_, i) =>
    fillTones(
      mixTones(
        mix.from.map(hex),
        mix.to.map(hex),
        mix.at + ((1 - mix.at) * mix.edge! * i) / (EDGE_LEVELS - 1),
      ),
      m.flat ? 0 : cool,
    ),
  )
}

/** A figure's colours: about two dozen, each with a job. */
const PALETTE = 24,
  MERGE = 0.035,
  MINOR = [0.075, 0.1, 12] as const
/**
 * The colour budget, as a pixel artist keeps one: a colour on fewer than 2·D² texels of a larger surface (a fleck of a
 * fourth shadow) takes the nearest colour round it on that surface that has its place, and while the figure has more
 * than `PALETTE` colours the closest pair painted on one material (ΔE under `MERGE`) merge, the rarer into the
 * commoner. The face's own marks (eyes, brows, lips), a gloss's shine and a hologram's ramp (`kept`) are its accents,
 * and stay.
 */
export function budget(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  D: number,
  kept: Uint8Array,
  mat: (k: number) => number,
  /** An outline colour that is not black (`PaintStyle.ink`): never the colour a speck joins, as black never is by its distance. */
  ink = -1,
) {
  const n = w * h,
    col = new Int32Array(n).fill(-1),
    count = new Map<number, number>()
  for (let k = 0; k < n; k++)
    if (out[k * 4 + 3]) {
      const c = (out[k * 4] << 16) | (out[k * 4 + 1] << 8) | out[k * 4 + 2]
      col[k] = c
      count.set(c, (count.get(c) ?? 0) + 1)
    }
  const size = new Map<number, number>()
  for (let k = 0; k < n; k++) if (col[k] >= 0) size.set(mat(k), (size.get(mat(k)) ?? 0) + 1)
  const floor = 2 * D * D,
    dist = (a: number, b: number) => {
      const p = oklab(a),
        q = oklab(b)
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    }
  const to = new Int32Array(n).fill(-1)
  for (let k = 0; k < n; k++) {
    const c = col[k],
      m = mat(k)
    if (c < 0 || kept[k] || count.get(c)! >= floor || size.get(m)! < floor) continue
    const x = k % w,
      y = (k - x) / w
    let best = -1,
      bd = Infinity
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx,
          yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const q = col[yy * w + xx]
        if (q < 0 || q === c || q === ink || count.get(q)! < floor || mat(yy * w + xx) !== m) continue
        const d = dist(c, q)
        if (d < bd) {
          bd = d
          best = q
        }
      }
    if (best >= 0) to[k] = best
  }
  for (let k = 0; k < n; k++)
    if (to[k] >= 0) {
      count.set(col[k], count.get(col[k])! - 1)
      col[k] = to[k]
      count.set(to[k], count.get(to[k])! + 1)
    }
  for (const [c, m] of count) if (!m) count.delete(c)
  // Then a colour still on fewer than 2·D² texels of the whole figure, whatever it is painted on (a buckle's grey, a
  // seam's fleck), is the nearest colour round it that has its place, within a step (ΔE 0.15): no colour is a speck.
  to.fill(-1)
  for (let k = 0; k < n; k++) {
    const c = col[k]
    if (c < 0 || kept[k] || count.get(c)! >= floor) continue
    const x = k % w,
      y = (k - x) / w
    let best = -1,
      bd = 0.15
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx,
          yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const q = col[yy * w + xx]
        if (q < 0 || q === c || q === ink || count.get(q)! < floor) continue
        const d = dist(c, q)
        if (d < bd) {
          bd = d
          best = q
        }
      }
    if (best >= 0) to[k] = best
  }
  for (let k = 0; k < n; k++)
    if (to[k] >= 0) {
      count.set(col[k], count.get(col[k])! - 1)
      col[k] = to[k]
      count.set(to[k], count.get(to[k])! + 1)
    }
  for (const [c, m] of count) if (!m) count.delete(c)
  // The pairs: colours painted on one material, close enough to be one step; and any two the eye cannot part (within
  // `MERGE / 1.2`, two near-blacks of two cloths), whatever they are painted on.
  const on = new Map<number, Set<number>>()
  for (let k = 0; k < n; k++)
    if (col[k] >= 0 && !kept[k]) {
      const m = mat(k)
      let s = on.get(m)
      if (!s) {
        s = new Set()
        on.set(m, s)
      }
      s.add(col[k])
    }
  const pairs: [number, number, number][] = []
  for (const s of on.values()) {
    const cs = [...s]
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        const d = dist(cs[i], cs[j])
        if (d < MERGE) pairs.push([d, cs[i], cs[j]])
      }
  }
  {
    const cs = [...new Set([...on.values()].flatMap((s) => [...s]))]
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        const d = dist(cs[i], cs[j])
        if (d < MERGE / 1.2) pairs.push([d, cs[i], cs[j]])
      }
  }
  pairs.sort((a, b) => a[0] - b[0])
  const into = new Map<number, number>(),
    root = (c: number): number => {
      const r = into.get(c)
      return r === undefined ? c : root(r)
    }
  let colours = count.size
  for (const [, a0, b0] of pairs) {
    if (colours <= PALETTE) break
    const a = root(a0),
      b = root(b0)
    if (a === b) continue
    const [keep, drop] = count.get(a)! >= count.get(b)! ? [a, b] : [b, a]
    into.set(drop, keep)
    count.set(keep, count.get(keep)! + count.get(drop)!)
    count.delete(drop)
    colours--
  }
  // Still over: a minor tone (under `MINOR[1]` of each material it is painted on, or on small parts only, under
  // `MINOR[2]·D²` texels: a wash's second step, a deep's sliver, a pocket's facing, a chain's fourth grey) joins the
  // nearest colour of the figure within `MINOR[0]`, so the form's own steps (each material's main tones) stay.
  if (colours > PALETTE) {
    const by = new Map<number, Map<number, number>>(),
      mats = new Map<number, Set<number>>()
    for (let k = 0; k < n; k++)
      if (col[k] >= 0 && !kept[k]) {
        const m = mat(k),
          c = root(col[k])
        let t = by.get(m)
        if (!t) {
          t = new Map()
          by.set(m, t)
        }
        t.set(c, (t.get(c) ?? 0) + 1)
        let s = mats.get(c)
        if (!s) {
          s = new Set()
          mats.set(c, s)
        }
        s.add(m)
      }
    /** Of one family: both near-grey, or of hues within 12° and like chroma (a pocket facing may be the jeans' shadow,
     * never a puffer's blue the jeans' violet, nor a buckle's gold the skin's light). */
    const alike = (a: number, b: number) => {
      const p = oklab(a),
        q = oklab(b),
        ca = Math.hypot(p[1], p[2]),
        cb = Math.hypot(q[1], q[2])
      if (ca < 0.035 && cb < 0.035) return true
      const dh = Math.abs(Math.atan2(p[2], p[1]) - Math.atan2(q[2], q[1]))
      return Math.min(dh, 2 * Math.PI - dh) < 0.21 && Math.min(ca, cb) > 0.6 * Math.max(ca, cb)
    }
    const minor = (c: number) =>
      [...(mats.get(c) ?? [])].every(
        (m) => (by.get(m)!.get(c) ?? 0) < MINOR[1] * size.get(m)! || size.get(m)! < MINOR[2] * D * D,
      )
    const near: [number, number, number][] = []
    {
      const cs = [...mats.keys()]
      for (let i = 0; i < cs.length; i++)
        for (let j = i + 1; j < cs.length; j++) {
          const d = dist(cs[i], cs[j])
          if (d < MINOR[0] && (minor(cs[i]) || minor(cs[j])) && alike(cs[i], cs[j]))
            near.push([d, cs[i], cs[j]])
        }
    }
    near.sort((a, b) => a[0] - b[0])
    for (const [, a0, b0] of near) {
      if (colours <= PALETTE) break
      const a = root(a0),
        b = root(b0)
      if (a === b || !count.has(a) || !count.has(b)) continue
      const drop = minor(a) && (!minor(b) || count.get(a)! <= count.get(b)!) ? a : minor(b) ? b : -1
      if (drop < 0) continue
      const keep = drop === a ? b : a
      into.set(drop, keep)
      count.set(keep, count.get(keep)! + count.get(drop)!)
      count.delete(drop)
      colours--
      for (const m of mats.get(drop) ?? []) {
        const t = by.get(m)!
        t.set(keep, (t.get(keep) ?? 0) + (t.get(drop) ?? 0))
        t.delete(drop)
        mats.get(keep)?.add(m) ?? mats.set(keep, new Set([m]))
      }
      mats.delete(drop)
    }
  }
  for (let k = 0; k < n; k++) {
    if (col[k] < 0) continue
    const c = kept[k] ? col[k] : root(col[k])
    out[k * 4] = (c >> 16) & 255
    out[k * 4 + 1] = (c >> 8) & 255
    out[k * 4 + 2] = c & 255
  }
}

// ─── The paint pass ───
export const isArm = (gr: number) => gr === GROUP.armL || gr === GROUP.armR,
  isLeg = (gr: number) => gr === GROUP.legL || gr === GROUP.legR
/** Whether two body regions can lie against each other and want a line between: an arm and the trunk, a hand and a
 * leg, two legs, two arms. The hips are where the legs grow from: none there. */
export function touching(a: number, b: number) {
  if (a === b) return false
  if (a === GROUP.torso || b === GROUP.torso) return isArm(a) || isArm(b)
  return (isArm(a) || isLeg(a)) && (isArm(b) || isLeg(b))
}
/** The cell's texel density: the cast's presets are 36.9 texels a metre at 64 (or 48) texels wide. */
export const densityOf = (w: number) => Math.max(1, Math.round(w / 64))
/** A colour moved in OKLab (lightness, and toward warm or cool) and snapped back to DUEL, a step off `from` at least. */
function shifted(from: number, dL: number, warm: number) {
  const [L, A, B] = oklab(from)
  for (let i = 1; i <= 4; i++) {
    const t = duelLab(L + dL * i, A * (1 + 0.1 * i) + warm * 0.4 * i, B * (1 + 0.1 * i) + warm * i)
    if (t !== from) return t
  }
  return from
}
export const INK_RGB = duel(hex(INK))
/** Warm: a red, orange, yellow or brown with some colour in it (skin, tan, leather, sticker yellow). Its ramp keeps the
 * hues picked for it, as a cool lean turns skin and browns mauve and yellows olive. */
function warm(c: number) {
  const [, A, B] = oklab(c),
    h = Math.atan2(B, A)
  return Math.hypot(A, B) > 0.02 && h > -0.35 && h < 1.9
}
/** A colour's place on the DUEL rows: its row (`prefer`, the material's own, where it is on it) and step; null off them. */
export function onRow(c: number, prefer: number): [number, number] | null {
  const i = RAMPS[prefer]?.indexOf(c) ?? -1
  if (i >= 0) return [prefer, i]
  for (let r = 0; r < RAMPS.length; r++) {
    const j = RAMPS[r].indexOf(c)
    if (j >= 0) return [r, j]
  }
  return null
}
/** A step down a colour's own DUEL row: a darker tone of its own hue, never ink (a row's last step holds). */
function down(c: number, prefer: number) {
  const at = onRow(c, prefer)
  if (!at || at[1] === 0) return c
  const t = RAMPS[at[0]][at[1] - 1]
  return t === INK_RGB ? c : t
}
/** The darkest tones short of ink, a black's deepest fold: navy-black, plum-black, neutral (DUEL's teal outline kept out). */
const DARKEST = DUEL.filter((d) => d.c !== INK_RGB && d.c !== RAMP_OUTLINE && d.lab[0] < 0.25)
/**
 * The figure's darks: below this lightness a tone is a near-black, and every near-black but ink is one of two: the
 * neutral near-black for a warm or neutral ramp (hair, black cloth, leather), the navy-black for a cool one (cobalt,
 * navy). At 1x five near-blacks of five hues read as mud, and a navy line down black cloth as piping; one ramp's darks
 * are always one family, so a braid is never plum and navy at once.
 */
const NEAR_BLACK = 0.262,
  DARK_NEUTRAL = 0x1d1d21,
  DARK_COOL = 0x181f2f
/** A ramp's deep tone is a near-black a little higher, unless it is a strong colour (a wine's deep keeps its hue): a
 * DUEL row's darkest step (denim's navy, a plum) is then the figure's family dark, not a fifth dark of its own. */
const DEEP_BLACK = 0.29,
  DEEP_CHROMA = 0.08
/** Whether a ramp's darks are the cool family: its mid tone leans blue. */
const coolRamp = (tones: number[]) => oklab(tones[1])[2] < -0.03
/** A tone as its family's near-black, when it is one (`deep`: the ramp's deep step). */
export function darkOf(c: number, cool: boolean, deep = false) {
  if (c === INK_RGB) return c
  const [L, A, B] = oklab(c)
  return L < NEAR_BLACK || (deep && L < DEEP_BLACK && Math.hypot(A, B) < DEEP_CHROMA)
    ? cool
      ? DARK_COOL
      : DARK_NEUTRAL
    : c
}
/** A ramp with its near-blacks folded into its family's. */
export function familyTones(tones: number[]) {
  const cool = coolRamp(tones)
  return tones.map((c, i) => darkOf(c, cool, i === 3))
}
/** Skin's line: a step down in value from its deep tone (0.045 to 0.1 in lightness), its hue held and its colour no
 * stronger than the deep's (a red or rust line reads as a cut or sunburn at 1x, and a dark one as a crack); on deep
 * skin its own deep is already as dark as a line should go. */
function skinLine(deep: number) {
  const [L, A, B] = oklab(deep),
    C = Math.hypot(A, B),
    H = Math.atan2(B, A)
  if (L < 0.35) return deep
  let best = Infinity,
    hit = deep
  for (const d of DUEL) {
    const [l, a, b] = d.lab,
      c = Math.hypot(a, b)
    if (l > L - 0.045 || l < L - 0.1 || c > C * 0.95) continue
    const e = (l - (L - 0.065)) ** 2 + 0.01 * (Math.atan2(b, a) - H) ** 2 + 0.5 * (c - C * 0.85) ** 2
    if (e < best) {
      best = e
      hit = d.c
    }
  }
  return hit
}
/** A ramp leaned cool by `cool` (see PaintStyle.cool) unless it is warm, and lifted off ink: a fill on ink fuses with the
 * outline, so it takes the darkest DUEL tone nearest the ramp's own hue (a black's leaned cool: navy-black). */
const filledTones = new Map<string, number[]>()
export function fillTones(tones: number[], cool: number) {
  const key = `${tones.join(',')}|${cool}`
  let hit = filledTones.get(key)
  if (hit) return hit
  const hot = warm(tones[1])
  const leaned = tones.map((c, i) => {
    if (i < 2 || !cool || hot) return c
    const [L, A, B] = oklab(c),
      w = cool * (i === 2 ? 0.75 : 1.25)
    return duelLab(L, A - w * 0.3, B - w)
  })
  const ref = leaned
    .filter((c) => c !== INK_RGB)
    .map(oklab)
    .sort((a, b) => a[0] - b[0])[0] ?? [0, 0, 0]
  const ra = ref[1],
    rb = ref[2] - (hot ? 0 : 0.02)
  const lift = DARKEST.reduce((best, d) =>
    (d.lab[1] - ra) ** 2 + (d.lab[2] - rb) ** 2 < (best.lab[1] - ra) ** 2 + (best.lab[2] - rb) ** 2
      ? d
      : best,
  ).c
  const isCool = coolRamp(tones)
  hit = leaned.map((c, i) => darkOf(c === INK_RGB ? lift : c, isCool, i === 3))
  filledTones.set(key, hit)
  return hit
}
/** A dark ramp (black cloth, leather, a black frame): its mid tone this dark. Black has form only in three readable
 * values, so its folds are ink, its lit edge a cool rim and its gloss a tight grey (see extraTones). */
export const DARK_MID = 0.34
/**
 * A material's own darks and its shine, DUEL-snapped:
 * - fold: its deep tone a step down its own DUEL row. A line inside the figure (a sleeve over the body, an arm against
 *   the ribs, the jaw over the neck) is drawn on the far surface in its fold, so it reads as a soft fold in that cloth
 *   or skin, not a crack; ink is the silhouette's alone. A light ramp whose next step falls out of its family (yellow
 *   into rust) folds in its deep itself; a dark one folds in ink, a step under its deep, as nothing else is.
 * - line: the selective outline's lit side: a ramp's deep itself while that is no near-black (cobalt's lit edge is
 *   cobalt), else the fold, so the line stays in the material's own hue.
 * - shine: its light tone a step lighter and warmer, a gloss's highlight; on a dark ramp a tight cool grey well above
 *   its light (leather's crease catching the key), never white.
 * - rim: a dark ramp's lit edge, a cool step over its light tone, so black reads as a form against the dark.
 * Skin's line and fold step down along a warm neutral (skinLine), never to a red; a dark's fold is its family's.
 */
/**
 * The selective outline's lit side, as a sprite artist draws it: never lost on the ground. The line is the ramp's own
 * hue, a little richer than its deep tone, but at most LIT_LINE in lightness and at least LIT_STEP under the deep, so a
 * white tee or pale skin keeps a crisp coloured edge on any background, and the figure is one closed shape.
 */
const LIT_LINE = 0.46,
  LIT_STEP = 0.16,
  LIT_FLOOR = 0.24
function litLine(line: number, deep: number, skin = false) {
  const [L] = oklab(line),
    [Ld, A, B] = oklab(deep),
    target = Math.max(LIT_FLOOR, Math.min(L, Ld - LIT_STEP, LIT_LINE))
  if (target >= L - 0.01) return line
  // Skin's edge a warm brown (its hue turned a little toward orange, its colour no stronger), never a red.
  const C = Math.hypot(A, B),
    H = Math.atan2(B, A) + (skin ? 0.25 : 0),
    c = skin ? C * 0.85 : C < 0.015 ? 0 : Math.min(0.12, C * 1.35 + 0.01)
  return duelLab(target, c * Math.cos(H), c * Math.sin(H))
}
const extras = new Map<string, { line: number; fold: number; shine: number; rim: number }>()
export function extraTones(tones: number[], ramp: number, skin = false, black = false) {
  const key = `${tones.join(',')}|${ramp}|${skin}|${black}`
  let hit = extras.get(key)
  if (!hit) {
    const [L0] = oklab(tones[0]),
      [Ld] = oklab(tones[3]),
      dark = black,
      next = down(tones[3], ramp)
    const fold = skin
      ? skinLine(tones[3])
      : dark
        ? INK_RGB
        : Ld > 0.55 && oklab(next)[0] < 0.62
          ? tones[3]
          : darkOf(next, coolRamp(tones))
    const line = dark
      ? darkOf(next, coolRamp(tones))
      : litLine(skin ? fold : Ld > DEEP_BLACK && Ld <= 0.55 ? tones[3] : fold, tones[3], skin)
    const shine = dark ? duelLab(L0 + DARK_SHINE, 0, -0.012) : shifted(tones[0], 0.07, 0.008),
      rim = dark ? duelLab(L0 + 0.08, 0, -0.02) : tones[0]
    hit = { line, fold, shine, rim }
    extras.set(key, hit)
  }
  return hit
}
/** The key in the cell's own axes (x right, y down), toward the light: where a shadow's caster and a lit edge lie. */
export const K2 = (() => {
  const x = KEY[0],
    y = -KEY[1],
    l = Math.hypot(x, y)
  return [x / l, y / l] as const
})()
/** How far a ray toward the key climbs (m) for each metre it runs across the cell. */
export const RISE = KEY[2] / Math.hypot(KEY[0], KEY[1])
/** An outline texel's tone: ink, or (on the key's side of its shape) the shape's own line tone; and a dark ramp's rim. */
export const OUTLINE = 9,
  LINE = 10,
  RIM = 11
/** The hair's sheen band: the window of its surface's rise (the normal's y in view space) the band lies in. */
export const SHEEN = [0.64, 0.8] as const
/**
 * A dark gloss's sheen (leather, patent, a black frame; the `hard` rule below): one soft patch per surface where it mirrors
 * the key best, not a line over every ring. The patch is the top `GLOSS_SHEEN · gloss` of the surface's texels by their
 * mirror term, at most `SHEEN_MAX · D²` of them, and none on a surface under `SHEEN_MIN · D²` texels; its shine is
 * `DARK_SHINE` of lightness over the light tone, a grey over black.
 */
export const GLOSS_SHEEN = 0.12,
  SHEEN_MIN = 6,
  SHEEN_MAX = 10,
  DARK_SHINE = 0.12
/** The patch's share of its surface at density D, against D2's: a highlight is a few texels, so as the texels shrink the patch
 * keeps its look at D1 and D2 and falls to a third of the area at D4 (and a ninth at D8). */
export const sheenScale = (D: number) => (D <= 2 ? 1 : 3 ** -Math.log2(D / 2))
/** A mirror lens's tint (holo `'mirror'`): its body a dark of its ramp's hue, lit and dark, and what shows through it
 * (`see`): an eye's white a muted step of that hue, its iris and lash the tint's dark. The tint's steps sit at MIRROR. */
export const MIRROR = 4,
  MIRROR_SKY = 0.4
const tints = new Map<string, number[]>()
export function tint(ramp: number[]) {
  const key = ramp.join()
  let t = tints.get(key)
  if (!t) {
    const [, A, B] = oklab(ramp[3]),
      c = Math.hypot(A, B) || 1,
      dark = coolRamp(ramp) ? DARK_COOL : DARK_NEUTRAL
    t = [
      duelLab(0.34, (A / c) * 0.055, (B / c) * 0.055),
      dark,
      duelLab(0.45, (A / c) * 0.07, (B / c) * 0.07),
      dark,
    ]
    tints.set(key, t)
  }
  return t
}
