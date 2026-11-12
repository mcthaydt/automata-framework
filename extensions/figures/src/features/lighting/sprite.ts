import type { V3 } from '../../lib/math';
import { RAMPS, RAMP_OUTLINE } from '../paint/duel-ramps';
import { oklab } from '../paint/paint';
import { onRow, tiled } from '../paint/row';
import { grade } from './grade';
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
  /** The rim: the first texel in from the painter's outline is rimmed where the lamps' share on its outward
   * side is at least this fraction of their total. A texel with no normal gets none. */
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
const DX = [-1, 1, 0, 0], DY = [0, 0, -1, 1];
const INK = 0;
const colourAt = (px: Uint8ClampedArray, o: number) => (px[o] << 16) | (px[o + 1] << 8) | px[o + 2];
/** The working arrays of one call, kept between calls (a walking figure lights several cells a frame, and a fresh 600 KB each time is
 * what makes a frame's worst case a collection). Only the output is a new array; `lightSprite` is synchronous, so one set is enough. */
interface Scratch { n: number; ground: Int32Array; rows: Int8Array; steps: Int8Array; held: Uint8Array; lit: Float32Array; hasN: Uint8Array; form: Int8Array; settled: Int8Array }
let scratch: Scratch | null = null;
function scratchFor(n: number): Scratch {
  if (scratch === null || scratch.n !== n) scratch = { n, ground: new Int32Array(n), rows: new Int8Array(n), steps: new Int8Array(n), held: new Uint8Array(n), lit: new Float32Array(n), hasN: new Uint8Array(n), form: new Int8Array(n), settled: new Int8Array(n) };
  return scratch;
}
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
  const [w, h] = f.cell, n = w * h, style = L.style ?? SPRITE_STYLE, weave = f.weave ?? null, src = f.painted, N = f.normals;
  const out = src.slice(), shift = flatSteps(L.flat, style) - (L.exposure ?? 0);
  const lamps = L.lamps.filter(l => l.strength > 0), total = lamps.reduce((s, l) => s + l.strength, 0);
  // What each texel is lit from, read once: its colour (a fabric's ground where the tile is laid, else the painted colour; −1 for
  // an empty texel), its row and step, and whether it holds (rule 1). Colours run in patches, so the last one is reused.
  const { ground, rows, steps, held, lit, hasN, form, settled } = scratchFor(n);
  ground.fill(-1); hasN.fill(0); form.fill(0);
  let lastColour = -1, lastRow = 0, lastStep = 0, lastHeld = 0, x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let k = 0; k < n; k++) {
    const o = k * 4;
    if (!src[o + 3]) continue;
    const kx = k % w, ky = (k - kx) / w;
    if (kx < x0) x0 = kx;
    if (kx > x1) x1 = kx;
    if (ky < y0) y0 = ky;
    if (ky > y1) y1 = ky;
    const from = weave !== null && weave.on[k] === 1 ? weave.ground : src, c = colourAt(from, o);
    ground[k] = c;
    if (c !== lastColour) {
      [lastRow, lastStep] = onRow(c);
      lastHeld = c === INK || c === RAMP_OUTLINE || lastStep === 0 ? 1 : 0;
      lastColour = c;
    }
    rows[k] = lastRow; steps[k] = lastStep; held[k] = lastHeld;
  }
  // Rule 3's light: Σ max(0, n · dir) × strength, and its mean over the filled texels that have a normal.
  const pc = Math.cos(f.pitch), ps = Math.sin(f.pitch), m = lamps.length;
  const lx = Float64Array.from(lamps, l => l.dir[0]), ly = Float64Array.from(lamps, l => l.dir[1]), lz = Float64Array.from(lamps, l => l.dir[2]), ls = Float64Array.from(lamps, l => l.strength);
  let sum = 0, count = 0;
  if (total > 0) for (let y = y0; y <= y1; y++) for (let x = x0, k = y * w + x0; x <= x1; x++, k++) {
    const o = k * 4;
    if (!src[o + 3] || !N[o + 3]) continue;
    // `viewToWorld` (lamps.ts), written out so the loop allocates nothing.
    const vx = N[o] / 127.5 - 1, vy = 1 - N[o + 1] / 127.5, vz = N[o + 2] / 127.5 - 1, nx = vx, ny = vy * pc + vz * ps, nz = -vy * ps + vz * pc;
    let s = 0;
    for (let i = 0; i < m; i++) s += Math.max(0, nx * lx[i] + ny * ly[i] + nz * lz[i]) * ls[i];
    lit[k] = s; hasN[k] = 1; sum += s; count++;
  }
  const facing = count ? sum / count : 0;
  // Rules 3 and 4: a form of one step, or a rim of one step instead.
  if (total > 0) {
    const side = SIDES.map(([dx, dy]) => lamps.reduce((s, l) => (Math.hypot(l.dir[0], l.dir[1]) < style.rimSide ? s : s + Math.max(0, l.dir[0] * dx + l.dir[1] * dy) * l.strength), 0) >= style.rim * total);
    const rimDx = SIDES.filter((_, i) => side[i]).map(([dx]) => dx), rimDy = SIDES.filter((_, i) => side[i]).map(([, dy]) => dy);
    const up = facing + style.threshold * total, down = facing - style.threshold * total;
    // The rim: on a side the lamps favour, empty beside the texel, or empty past one held texel. An image's y runs down, so the
    // neighbour above is the picture plane's +y. The painter outlines the silhouette (a step 0 or ink texel, which holds), so the
    // rim is the first texel in from it.
    const empty = (px: number, py: number) => px < 0 || py < 0 || px >= w || py >= h || ground[py * w + px] < 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w + x;
      // A texel with no normal (a flat material, a held item) is lit by the flat light alone: no form, no rim.
      if (ground[k] < 0 || held[k] === 1 || !hasN[k]) continue;
      let rim = false;
      for (let i = 0; i < rimDx.length && !rim; i++) {
        const x1 = x + rimDx[i], y1 = y - rimDy[i];
        rim = empty(x1, y1) || (held[y1 * w + x1] === 1 && empty(x + 2 * rimDx[i], y - 2 * rimDy[i]));
      }
      form[k] = rim ? 1 : lit[k] > up ? 1 : lit[k] < down ? -1 : 0;
    }
  }
  // Rule 5: a lone texel takes what its same-coloured neighbours agree on. From a copy, so the order does not matter.
  settled.set(form);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * w + x;
    if (ground[k] < 0 || held[k] === 1) continue;
    const c = ground[k], f0 = form[k];
    // Nothing to settle where every neighbour (empty ones count 0) has this texel's own form.
    if ((x === 0 || form[k - 1] === f0) && (x === w - 1 || form[k + 1] === f0) && (y === 0 || form[k - w] === f0) && (y === h - 1 || form[k + w] === f0)) continue;
    let near = 0, v = 0, agree = true;
    for (let i = 0; i < 4; i++) {
      const nx = x + DX[i], ny = y + DY[i], j = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || ground[j] !== c) continue;
      if (near === 0) v = form[j]; else if (form[j] !== v) agree = false;
      near++;
    }
    if (near >= 2 && agree && v !== form[k]) settled[k] = v;
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
  // Rules 6 to 8, per texel; a colour and its step make one result, so each is worked out once (and the last is reused).
  const memo = new Map<number, number>();
  let lastKey = -1, lastCol = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0, k = y * w + x0; x <= x1; x++, k++) {
    if (ground[k] < 0) continue;
    const on = weave !== null && weave.on[k] === 1;
    // A texel nothing changes keeps the painted bytes (a fabric's tile was laid by the painter on the same ground).
    if (held[k] === 1 && !on) continue;
    let col: number;
    if (held[k] === 1) col = ground[k];
    else {
      const to = Math.max(1, Math.min(7, steps[k] + shift + settled[k])), key = (ground[k] * 8 + to) * 2 + (on ? 1 : 0);
      if (key === lastKey) col = lastCol;
      else {
        let hit = memo.get(key);
        if (hit === undefined) {
          const stepped = RAMPS[rows[k]][to];
          // A fabric's ground keeps its own row: no tint to snap it onto a neighbour's, patch by patch.
          hit = on || tint < 0 ? stepped : grade(stepped, tint, amount);
          memo.set(key, hit);
        }
        col = hit; lastKey = key; lastCol = hit;
      }
    }
    if (on) col = tiled(col, weave!.labels[k], weave!.lo[k], weave!.hi[k]);
    const o = k * 4;
    out[o] = (col >> 16) & 255; out[o + 1] = (col >> 8) & 255; out[o + 2] = col & 255; out[o + 3] = 255;
  }
  return out;
}
