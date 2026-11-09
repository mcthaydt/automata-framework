import { atan2, cos, hypot, sin } from '@automata/sim/math'
import { oklab } from '../../../shared/math/colour.ts'
import { DUEL, duelLab, INK_RGB, RAMP_OUTLINE, RAMPS } from './duel-snap.ts'
import { must, sq } from './vec.ts'

/** A face's white as one step over the skin's mid (`skinMid`), the same on every skin: the white's own DUEL row's tone
 * nearest `by` over the mid in lightness, so on deep skin it is no brighter than the face's light (the eyes would read
 * as a row of dots) and on light skin as white as its row goes. */
export function eyeWhite(white: number, skinMid: number, by = 0.25): number {
  const top = oklab(skinMid)[0] + by,
    at = onRow(white, -1)
  if (!at) return white
  let best = white,
    bd = Infinity
  for (const c of must(RAMPS, at[0])) {
    const d = Math.abs(oklab(c)[0] - top)
    if (c !== INK_RGB && d < bd) {
      bd = d
      best = c
    }
  }
  return best
}
/** A colour moved in OKLab (lightness, and toward warm or cool) and snapped back to DUEL, a step off `from` at least. */
function shifted(from: number, dL: number, warm: number) {
  const [L, A, B] = oklab(from)
  for (let i = 1; i <= 4; i++) {
    const t = duelLab(L + dL * i, A * (1 + 0.1 * i) + warm * 0.4 * i, B * (1 + 0.1 * i) + warm * i)
    if (t !== from) return t
  }
  return from
}
/** Warm: a red, orange, yellow or brown with some colour in it (skin, tan, leather, sticker yellow). Its ramp keeps the
 * hues picked for it, as a cool lean turns skin and browns mauve and yellows olive. */
function warm(c: number) {
  const [, A, B] = oklab(c),
    h = atan2(B, A)
  return hypot(A, B) > 0.02 && h > -0.35 && h < 1.9
}
/** A colour's place on the DUEL rows: its row (`prefer`, the material's own, where it is on it) and step; null off them. */
function onRow(c: number, prefer: number): [number, number] | null {
  const i = RAMPS[prefer]?.indexOf(c) ?? -1
  if (i >= 0) return [prefer, i]
  for (let r = 0; r < RAMPS.length; r++) {
    const j = must(RAMPS, r).indexOf(c)
    if (j >= 0) return [r, j]
  }
  return null
}
/** A step down a colour's own DUEL row: a darker tone of its own hue, never ink (a row's last step holds). */
function down(c: number, prefer: number) {
  const at = onRow(c, prefer)
  if (!at || at[1] === 0) return c
  const t = must(RAMPS, at[0])[at[1] - 1] ?? Number.NaN
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
const coolRamp = (tones: number[]) => oklab(tones[1] ?? Number.NaN)[2] < -0.03
/** A tone as its family's near-black, when it is one (`deep`: the ramp's deep step). */
export function darkOf(c: number, cool: boolean, deep = false): number {
  if (c === INK_RGB) return c
  const [L, A, B] = oklab(c)
  return L < NEAR_BLACK || (deep && L < DEEP_BLACK && hypot(A, B) < DEEP_CHROMA)
    ? cool
      ? DARK_COOL
      : DARK_NEUTRAL
    : c
}
/** A ramp with its near-blacks folded into its family's. */
export function familyTones(tones: number[]): number[] {
  const cool = coolRamp(tones)
  return tones.map((c, i) => darkOf(c, cool, i === 3))
}
/** Skin's line: a step down in value from its deep tone (0.045 to 0.1 in lightness), its hue held and its colour no
 * stronger than the deep's (a red or rust line reads as a cut or sunburn at 1x, and a dark one as a crack); on deep
 * skin its own deep is already as dark as a line should go. */
function skinLine(deep: number) {
  const [L, A, B] = oklab(deep),
    C = hypot(A, B),
    H = atan2(B, A)
  if (L < 0.35) return deep
  let best = Infinity,
    hit = deep
  for (const d of DUEL) {
    const [l, a, b] = d.lab,
      c = hypot(a, b)
    if (l > L - 0.045 || l < L - 0.1 || c > C * 0.95) continue
    const e = sq(l - (L - 0.065)) + 0.01 * sq(atan2(b, a) - H) + 0.5 * sq(c - C * 0.85)
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
export function fillTones(tones: number[], cool: number): number[] {
  const key = `${tones.join(',')}|${cool}`
  let hit = filledTones.get(key)
  if (hit) return hit
  const hot = warm(tones[1] ?? Number.NaN)
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
    sq(d.lab[1] - ra) + sq(d.lab[2] - rb) < sq(best.lab[1] - ra) + sq(best.lab[2] - rb) ? d : best,
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
  const C = hypot(A, B),
    H = atan2(B, A) + (skin ? 0.25 : 0),
    c = skin ? C * 0.85 : C < 0.015 ? 0 : Math.min(0.12, C * 1.35 + 0.01)
  return duelLab(target, c * cos(H), c * sin(H))
}
const extras = new Map<string, { line: number; fold: number; shine: number; rim: number }>()
export function extraTones(
  tones: number[],
  ramp: number,
  skin = false,
  black = false,
): {
  line: number
  fold: number
  shine: number
  rim: number
} {
  const key = `${tones.join(',')}|${ramp}|${skin}|${black}`
  let hit = extras.get(key)
  if (!hit) {
    const [L0] = oklab(tones[0] ?? Number.NaN),
      [Ld] = oklab(tones[3] ?? Number.NaN),
      dark = black,
      next = down(tones[3] ?? Number.NaN, ramp)
    const fold = skin
      ? skinLine(tones[3] ?? Number.NaN)
      : dark
        ? INK_RGB
        : Ld > 0.55 && oklab(next)[0] < 0.62
          ? (tones[3] ?? Number.NaN)
          : darkOf(next, coolRamp(tones))
    const line = dark
      ? darkOf(next, coolRamp(tones))
      : litLine(
          skin ? fold : Ld > DEEP_BLACK && Ld <= 0.55 ? (tones[3] ?? Number.NaN) : fold,
          tones[3] ?? Number.NaN,
          skin,
        )
    const shine = dark ? duelLab(L0 + 0.22, 0, -0.012) : shifted(tones[0] ?? Number.NaN, 0.07, 0.008),
      rim = dark ? duelLab(L0 + 0.08, 0, -0.02) : (tones[0] ?? Number.NaN)
    hit = { line, fold, shine, rim }
    extras.set(key, hit)
  }
  return hit
}
const tints = new Map<string, number[]>()
export function tint(ramp: number[]): number[] {
  const key = ramp.join()
  let t = tints.get(key)
  if (!t) {
    const [, A, B] = oklab(ramp[3] ?? Number.NaN),
      c = hypot(A, B) || 1,
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
