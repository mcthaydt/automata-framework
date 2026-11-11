import type { V3 } from '../../lib/math';
import { RAMPS, RAMP_OUTLINE } from '../paint/duel-ramps';
import { oklab } from '../paint/paint';
import { onRow, tiled } from '../paint/row';
import { grade } from './grade';
import { viewToWorld } from './lamps';
import type { LitSource } from './light';
/**
 * A painted figure lit as a sprite by the room it stands in (c8-lit): one flat light for the whole figure, taken in whole
 * DUEL steps; a form of one step where a texel's normal faces the lamps clearly more or less than the figure's mean; a rim
 * of one step on the lamps' side of the silhouette; and the flat light's warmth, tinted through `grade`. A pure function of
 * its arguments, so the same inputs light the same bytes in every engine and a host can cache the result by them.
 *
 * It is not `lightFigure`: that one lights lamp pool by lamp pool across the figure and reads the figure's place in a
 * world. This one has no place: the host reads the room where the figure stands and says, in a few numbers, what it is
 * like there (`SpriteLighting`). Every texel moves along its own DUEL row; the one way off a row is `grade`'s tint, the
 * sanctioned one.
 */
/** One lamp seen from the figure: a unit direction toward it, in the figure's lighting frame (docs/contract.md section 3:
 * x to the screen's right, y up, z toward the camera), and its strength in light units. */
export interface SpriteLamp { dir: V3; strength: number }
/** The numbers the rules use, every one named so the gate can tune them. */
export interface SpriteStyle {
  /** The form: a texel is a step up (or down) where its light is this fraction of the lamps' total strength over (under) the figure's mean. */
  threshold: number;
  /** The rim: a silhouette texel is rimmed where the lamps' share on its outward side is at least this fraction of their total. */
  rim: number;
  /** A lamp whose pull across the picture plane (its x and y) is under this is nearly along the view axis and rims nothing. */
  rimSide: number;
  /** One DUEL step's ratio in the peak sRGB channel (measured at the median over steps 1 to 7 of the 32 rows). */
  stepRatio: number;
  /** The flat light's steps are held to `down` … `up`. */
  down: number; up: number;
  /** The flat light tints only where its OKLab chroma (at full value) is over this. */
  chroma: number;
  /** The tint's weight, as `lightFigure`'s lamp `tint`: the amount is `tint × 0.7`, in eighths. */
  tint: number;
}
export const SPRITE_STYLE: SpriteStyle = { threshold: 0.22, rim: 0.35, rimSide: 0.25, stepRatio: 1.17, down: -3, up: 2, chroma: 0.02, tint: 0.35 };
/** The room's light on one figure, in the figure's lighting frame. */
export interface SpriteLighting {
  /** The room's light where the figure stands, RGB in light units: 1 is as painted. */
  flat: V3;
  /** Where the light comes from, each with its strength. May be empty (an even light: no form, no rim). */
  lamps: SpriteLamp[];
  /** Whole steps taken off the flat light (0 or more): the host's exposure, to keep a figure no hotter than its ground. */
  exposure?: number;
  style?: SpriteStyle;
}
/** Whole DUEL steps for a light: `clamp(round(ln(peak) / ln(stepRatio)), down, up)`; `down` for a peak of 0 or less (or NaN). */
export function flatSteps(flat: V3, style: SpriteStyle = SPRITE_STYLE): number {
  const peak = Math.max(flat[0], flat[1], flat[2]);
  if (!(peak > 0)) return style.down;
  // `+ 0` turns a rounded −0 into 0, so a light a little under 1 is no step and not a negative zero.
  return Math.max(style.down, Math.min(style.up, Math.round(Math.log(peak) / Math.log(style.stepRatio)))) + 0;
}
/** The four neighbours, as outward directions in the picture plane (x right, y up; an image's y runs down). */
const SIDES: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const INK = 0;
const colourAt = (px: Uint8ClampedArray, o: number) => (px[o] << 16) | (px[o + 1] << 8) | px[o + 2];
/**
 * A painted cell lit as a sprite: a new RGBA cell. The rules, in order:
 * 1. An empty texel, ink, `RAMP_OUTLINE` and a texel on its row's step 0 (the painter's family darks) come out as they went in.
 * 2. The flat light, in whole steps: `flatSteps(flat) − exposure`.
 * 3. The form: each texel's normal is turned into the lighting frame; the figure's mean light is `facing`; a texel whose light
 *    clears it by `threshold` of the lamps' total strength takes +1, one under by as much −1.
 * 4. The rim: a texel on the lamps' side of the silhouette takes +1 instead. The silhouette is outlined (a held texel), so
 *    it is the first texel in from the outline: empty beside it, or empty past one held texel.
 * 5. Settle: a texel stepped unlike all of its same-coloured 4-neighbours (two or more, who agree) takes theirs.
 * 6. The step: a texel on row `r` at step `s ≥ 1` goes to `clamp(s + flat + form, 1, 7)` on row `r`.
 * 7. The warmth: where the flat light has a colour, `grade` tints toward it and snaps to DUEL.
 * 8. Fabric: a tiled texel lights its ground by 2 to 6, takes no tint, and the tile is laid after with `tiled`.
 */
export function lightSprite(f: LitSource, L: SpriteLighting): Uint8ClampedArray {
  const [w, h] = f.cell, style = L.style ?? SPRITE_STYLE, weave = f.weave ?? null, src = f.painted, N = f.normals;
  const out = src.slice(), shift = flatSteps(L.flat, style) - (L.exposure ?? 0);
  const lamps = L.lamps.filter(l => l.strength > 0), total = lamps.reduce((s, l) => s + l.strength, 0);
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] !== 0;
  /** The colour a texel is lit from: a fabric's ground where the tile is laid, else the painted colour. */
  const base = (k: number) => (weave && weave.on[k] === 1 ? weave.ground : src);
  /** Rule 1: whether the texel stays as it is. */
  const holds = (k: number) => {
    const c = colourAt(base(k), k * 4);
    return c === INK || c === RAMP_OUTLINE || onRow(c)[1] === 0;
  };
  // Rule 3's light: Σ max(0, n · dir) × strength, and its mean over the filled texels that have a normal.
  const lit = new Float32Array(w * h), hasN = new Uint8Array(w * h);
  let sum = 0, count = 0;
  if (total > 0) for (let k = 0; k < w * h; k++) {
    const o = k * 4;
    if (!src[o + 3] || !N[o + 3]) continue;
    const n = viewToWorld([N[o] / 127.5 - 1, 1 - N[o + 1] / 127.5, N[o + 2] / 127.5 - 1], f.pitch);
    let s = 0;
    for (const l of lamps) s += Math.max(0, n[0] * l.dir[0] + n[1] * l.dir[1] + n[2] * l.dir[2]) * l.strength;
    lit[k] = s; hasN[k] = 1; sum += s; count++;
  }
  const facing = count ? sum / count : 0;
  // Rules 3 and 4: a form of one step, or a rim of one step instead.
  const form = new Int8Array(w * h);
  if (total > 0) {
    const side = SIDES.map(([dx, dy]) => lamps.reduce((s, l) => (Math.hypot(l.dir[0], l.dir[1]) < style.rimSide ? s : s + Math.max(0, l.dir[0] * dx + l.dir[1] * dy) * l.strength), 0) >= style.rim * total);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (!src[k * 4 + 3] || holds(k)) continue;
      // An image's y runs down, so the neighbour above is the picture plane's +y. The painter outlines the silhouette (a
      // step 0 or ink texel, which holds), so the rim is the first texel in from it: empty beside it, or empty past one
      // held texel.
      const edge = (dx: number, dy: number) => !filled(x + dx, y - dy) || (holds((y - dy) * w + x + dx) && !filled(x + 2 * dx, y - 2 * dy));
      // A texel with no normal (a flat material, a held item) is lit by the flat light alone: no form, no rim.
      if (!hasN[k]) continue;
      if (SIDES.some(([dx, dy], i) => side[i] && edge(dx, dy))) { form[k] = 1; continue; }
      form[k] = lit[k] > facing + style.threshold * total ? 1 : lit[k] < facing - style.threshold * total ? -1 : 0;
    }
  }
  // Rule 5: a lone texel takes what its same-coloured neighbours agree on. From a copy, so the order does not matter.
  const settled = form.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (!src[k * 4 + 3] || holds(k)) continue;
    const c = colourAt(base(k), k * 4);
    let n = 0, v = 0, agree = true;
    for (const [dx, dy] of SIDES) {
      const nx = x + dx, ny = y + dy, j = ny * w + nx;
      if (!filled(nx, ny) || colourAt(base(j), j * 4) !== c) continue;
      if (n === 0) v = form[j]; else if (form[j] !== v) agree = false;
      n++;
    }
    if (n >= 2 && agree && v !== form[k]) settled[k] = v;
  }
  // Rule 7's tint: the flat light's colour at full value, where it has one.
  const peak = Math.max(L.flat[0], L.flat[1], L.flat[2]);
  let tint = -1;
  if (peak > 0) {
    const c = [0, 1, 2].map(i => Math.max(0, Math.min(255, Math.round(L.flat[i] / peak * 255))));
    const rgb = (c[0] << 16) | (c[1] << 8) | c[2], [, a, b] = oklab(rgb);
    if (Math.hypot(a, b) > style.chroma) tint = rgb;
  }
  const amount = Math.round(style.tint * 0.7 * 8) / 8;
  // Rules 6 to 8, per texel; a colour and its step make one result, so each is worked out once.
  const memo = new Map<number, number>();
  for (let k = 0; k < w * h; k++) {
    const o = k * 4;
    if (!src[o + 3]) continue;
    const on = weave !== null && weave.on[k] === 1, ground = colourAt(base(k), o);
    let col: number;
    if (holds(k)) col = ground;
    else {
      const [row, step] = onRow(ground), to = Math.max(1, Math.min(7, step + shift + settled[k])), key = (ground * 8 + to) * 2 + (on ? 1 : 0);
      let hit = memo.get(key);
      if (hit === undefined) {
        const stepped = RAMPS[row][to];
        // A fabric's ground keeps its own row: no tint to snap it onto a neighbour's, patch by patch.
        hit = on || tint < 0 ? stepped : grade(stepped, tint, amount);
        memo.set(key, hit);
      }
      col = hit;
    }
    if (on) col = tiled(col, weave!.labels[k], weave!.lo[k], weave!.hi[k]);
    // A texel nothing changes keeps the painted bytes (a fabric's tile was laid by the painter on the same ground).
    if (!on && holds(k)) continue;
    out[o] = (col >> 16) & 255; out[o + 1] = (col >> 8) & 255; out[o + 2] = col & 255; out[o + 3] = 255;
  }
  return out;
}
