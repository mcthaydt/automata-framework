import { RAMPS } from '../duel-ramps';
import { duel, oklab } from '../figure/paint';
/**
 * Colour moved the DUEL way: along a ramp in whole steps (stepBy), toward another colour in OKLab (toward), tinted by
 * a light's or a time's colour (grade), always snapped back to DUEL; and where a colour sits on the ramps (onRow).
 * Each is cached by its inputs, as it runs per texel. Extracted verbatim from the scene's paint, post and cast.
 */
const gam = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
/** An OKLab colour back to sRGB (an int). */
function rgbFromLab(L: number, A: number, B: number) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return (gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) << 16) | (gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) << 8) | gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}
/** A colour tinted toward `tint` (its hue and chroma, `amt` of the way; its lightness a little) and hazed toward `haze`
 * (all of it, `fog` of the way), then snapped to DUEL. Cached: a figure has few distinct inputs. */
const tinted = new Map<number, Map<number, Map<number, number>>>();
export function grade(rgb: number, tint: number, amt: number, haze = 0, fog = 0) {
  if (!amt && !fog) return rgb;
  // Keyed by numbers (tint, then haze, then the colour with its quantised amounts): this runs per texel per frame.
  let byTint = tinted.get(tint); if (!byTint) tinted.set(tint, byTint = new Map());
  let byHaze = byTint.get(haze); if (!byHaze) byTint.set(haze, byHaze = new Map());
  const key = rgb * 1024 + Math.round(amt * 16) * 32 + Math.round(fog * 16);
  let hit = byHaze.get(key);
  if (hit !== undefined) return hit;
  let [L, A, B] = oklab(rgb);
  if (amt) {
    const [tL, tA, tB] = oklab(tint);
    // Toward a hue across the wheel (a warm lamp on a blue quilt) the mix would pass through grey-green: tint it less.
    const dh = Math.abs(Math.atan2(B, A) - Math.atan2(tB, tA)), across = Math.hypot(A, B) > 0.03 && Math.min(dh, 2 * Math.PI - dh) > 1.7;
    const k = across ? amt * 0.35 : amt;
    A += (tA - A) * k; B += (tB - B) * k; L += (tL - L) * k * 0.15;
  }
  if (fog) { const [hL, hA, hB] = oklab(haze); L += (hL - L) * fog; A += (hA - A) * fog; B += (hB - B) * fog; }
  hit = duel(rgbFromLab(L, A, B));
  byHaze.set(key, hit);
  return hit;
}
/** A DUEL colour moved `by` steps along its own row (clamped; off-row colours are snapped first). */
const rowOf = new Map<number, [number, number]>();
export function stepBy(c: number, by: number) {
  let at = rowOf.get(c);
  if (!at) { const s = duel(c); at = [0, 0]; for (let r = 0; r < RAMPS.length; r++) { const i = RAMPS[r].indexOf(s); if (i >= 0) { at = [r, i]; break; } } rowOf.set(c, at); }
  const row = RAMPS[at[0]]; return row[Math.max(1, Math.min(7, at[1] + by))];
}
const mixed = new Map<string, number>();
/** A colour moved `amt` of the way toward another in OKLab, snapped. */
export function toward(c: number, t: number, amt: number) {
  const key = `${c}|${t}|${amt}`; let hit = mixed.get(key);
  if (hit === undefined) { const a = oklab(c), b = oklab(t); hit = duel(rgbFromLab(a[0] + (b[0] - a[0]) * amt * 0.5, a[1] + (b[1] - a[1]) * amt, a[2] + (b[2] - a[2]) * amt)); mixed.set(key, hit); }
  return hit;
}
/** Where a DUEL colour sits on the rows (its row and step), cached. */
const placeOf = new Map<number, [number, number]>();
export function onRow(c: number): [number, number] {
  let hit = placeOf.get(c);
  if (hit) return hit;
  let best = Infinity;
  RAMPS.forEach((row, r) => row.forEach((x, i) => { const d = ((x >> 16) - (c >> 16)) ** 2 + (((x >> 8) & 255) - ((c >> 8) & 255)) ** 2 + ((x & 255) - (c & 255)) ** 2; if (d < best) { best = d; hit = [r, i]; } }));
  placeOf.set(c, hit!);
  return hit!;
}
