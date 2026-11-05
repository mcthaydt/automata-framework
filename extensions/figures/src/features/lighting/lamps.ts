import { noise3 } from '../paint/raster';
import type { V3 } from '../../lib/math';
import timeLibrary from './library/times.json';
/**
 * The light a figure stands in, as a pixel artist lights a sprite: a time of day (its exposure, whole steps down the
 * ramps; the cast's lift over it; an ambient tint) and lamps whose pools lift a texel whole steps up its own ramp,
 * falling off in rings, tinting it their colour. Space is the figure's: metres from its feet, x to the screen's right,
 * y up, z toward the camera. Extracted from the scene's light (the scene is gone), verbatim.
 */
/** A lamp: where it is, its colour (hex) and how many tone steps it lifts a texel at its heart, how far it reaches (m);
 * a spot's aim and cone (degrees); a flicker (how much of its strength it can lose, how often, its seed); how far its
 * colour tints what it lights (0–1); a level (0 off, 1 as authored) and a light style (a letter a–z per 1/`styleRate`
 * s: 'a' dark, 'm' as authored, 'z' double). */
export interface Lamp {
  at: V3; color: string; steps: number; radius: number;
  aim?: V3; cone?: number;
  flicker?: number; rate?: number; seed?: number;
  tint?: number;
  level?: number; style?: string; styleRate?: number;
}
/** What a figure reads of a time of day: whole tone steps it sits down its ramps (night −2), the steps the cast stands
 * brighter than that (the value contrast games light their cast with), the ambient's tint (hex) and how far it tints
 * (0–1), and the painted key toward its source (view space; by default FIGURE_KEY). */
export interface TimeOfDay { exposure: number; figureLift?: number; ambient: string; tint: number; key?: V3 }
/** The times of day (library/times.json): day, golden, dusk, night, lampLit, bar. */
export const TIMES = timeLibrary as unknown as Readonly<Record<string, TimeOfDay>>;
/** The figures' painted key (paint.ts KEY), in view space. */
export const FIGURE_KEY: V3 = [-0.5, 0.62, 0.6];
const norm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** View space (x right, y up, z toward the camera) to world, for a camera pitched down by `pitch`. */
export const viewToWorld = (v: V3, pitch: number): V3 => { const c = Math.cos(pitch), s = Math.sin(pitch); return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c]; };
/** A lamp's strength at `t` (s): 1, or a flicker that drops in steps (a quarter at a time), now and then to nearly
 * nothing, held for a sprite frame (1/12 s) at a time. */
export function strength(l: Lamp, t: number) {
  const base = flickerOf(l, t);
  if (l.level === undefined && l.style === undefined) return base;
  // The runtime state's level and scripted style (state.ts): a light style's letter ('a' dark, 'm' as authored, 'z'
  // double) per 1/rate s, times the level, in quarters as the flicker is.
  const st = l.style ? styleAt(l.style, t, l.styleRate ?? 10) : 1;
  return Math.max(0, Math.round(base * st * (l.level ?? 1) * 4) / 4);
}
/** A light style's value at `t`: its letters a–z (a 0, m 1, z 2), one per 1/rate s, looping. */
function styleAt(style: string, t: number, rate = 10) {
  if (!style.length) return 1;
  const c = style.charCodeAt(Math.floor(Math.max(0, t) * rate + 1e-6) % style.length) - 97;
  return Math.max(0, Math.min(25, c)) / 12;
}
function flickerOf(l: Lamp, t: number) {
  if (!l.flicker) return 1;
  const tk = Math.floor(t * 12) / 12, rate = l.rate ?? 6, s = l.seed ?? 0;
  const v = noise3(tk * rate, s * 7.7, 0.5), dip = noise3(tk * rate * 0.37 + 9, s, 3.1) > 0.72 ? 0.85 : 0;
  return Math.max(0, 1 - Math.round((l.flicker * Math.max(0, v - 0.35) / 0.65 + dip * l.flicker) * 4) / 4);
}
/**
 * How many ramp steps a lamp lifts a surface at `p` facing `n`: its steps at its heart, falling off as (1 − (d/r)²)²
 * (smooth to its edge, so its rings come out evenly spaced), on a wrapped N·L (a floor under a lamp still catches it),
 * inside its cone if it is a spot.
 */
export function lampSteps(l: Lamp, s: number, px: number, py: number, pz: number, nx: number, ny: number, nz: number) {
  const dx = l.at[0] - px, dy = l.at[1] - py, dz = l.at[2] - pz, d2 = dx * dx + dy * dy + dz * dz, r2 = l.radius * l.radius;
  if (d2 >= r2 || s <= 0) return 0;
  const d = Math.sqrt(d2) || 1e-6, k = 1 - d2 / r2, wrap = 0.35;
  const lambert = Math.max(0, ((nx * dx + ny * dy + nz * dz) / d + wrap) / (1 + wrap));
  let cone = 1;
  if (l.aim && l.cone) { const a = norm(l.aim), c = -(a[0] * dx + a[1] * dy + a[2] * dz) / d, c0 = Math.cos(l.cone * Math.PI / 180); cone = Math.max(0, Math.min(1, (c - c0) / (1 - c0) * 3)); }
  return l.steps * s * k * k * lambert * cone;
}
