import { RAMPS, RAMP_OUTLINE } from './duel-ramps';
import { noise3, type GBuffer } from './raster';
import { smooth } from '../../lib/math';
import { fabricOf, labelAt, type Fabric } from './fabric';
import { GROUP, type Material } from '../body/parts';
import type { HeadShape } from '../body/genes';
/**
 * The painter: a figure's colours as pixel-art sprites are made, so a procedural figure is a sprite cell drawn live,
 * which the lighting feature (src/features/lighting) then lights from its normal map.
 *
 * - Every material has a short hand-picked ramp (light, mid, shadow, deep), snapped to DUEL.
 * - One painted key light, up and to the left, on normals smoothed over each part: clean clusters, mostly mid tone, a
 *   small light, a shadow side. Crevices (a nearer part beside) fall a tone.
 * - A warm near-black outline on the silhouette; where one part passes in front of another, a line in the far
 *   surface's own dark step. No fill is ink: a ramp that reaches it stops at its darkest step short of ink.
 * - The face is drawn on the lit head: placed from its landmarks, sized from its width, in its own colours and in
 *   steps along the skin's ramp.
 * - Out: the albedo, and a normal map (a normal's x, y, z as 0–255, alpha 0 where there is none) for the lighting.
 */
/** The outline's colour: DUEL black. */
const INK = '#000000';
/** The painted key: up, left and toward the viewer (sprite space: x right, y up, z toward the camera). */
const KEY = (() => { const v = [-0.5, 0.62, 0.6], l = Math.hypot(...v); return v.map(c => c / l) as [number, number, number]; })();
/** The key a face is painted by: the key turned part way to the camera. */
const FACE_KEY = (() => { const v = [KEY[0], KEY[1], KEY[2] + 0.25], l = Math.hypot(...v); return v.map(c => c / l) as [number, number, number]; })();
export interface PaintStyle {
  /** Key-light thresholds between light | mid | shadow | deep. */
  tones: [number, number, number];
  /** Depth (m) at which a nearer part beside draws the ink line, and at which it casts a crevice tone. */
  line: number; crevice: number;
  /** Normal smoothing radius (texels), within a part. */
  smooth: number;
  /** How far hair's strand clumps move it along its ramp. */
  strands: number;
  /** Depth (m) within which the smoothing runs on across a join between parts of one region and cloth. */
  blend: number;
  /** Cast shadow: how far (texels at density 1) a nearer part toward the key throws its shadow (the chin on the neck,
   * a fringe on the brow, an arm on the ribs), and the depth (m) it must stand clear of the surface by. */
  shadow: number; shadowDepth: number;
  /** The selective outline: on the side toward the key, each shape's own line tone (its deep tone darker still); on the
   * side away and underneath, ink. Off: ink all round. */
  selout: boolean;
  /** Reflected light: the deep tone next to the outline on the shadow side lifts a tone, so a form turns, not flattens. */
  bounce: boolean;
  /** A tone cluster smaller than this (texels at density 1, x density squared past it) joins its surroundings. */
  cluster: number;
  /** Hue-shifted shadows: how far the shadow and deep tones lean cool (toward blue-violet, in OKLab b) before they snap
   * back to DUEL, so a black coat's shadow is navy rather than muddy; 0 keeps each ramp as picked. Warm ramps (skin,
   * browns, yellows) always keep theirs. */
  cool: number;
  /** Cloth's broad folds: how far a slow noise on its surface moves its terminator (0 keeps the tones on the form). */
  folds: number;
  /** A face's key-light thresholds on its planes (facePlane), and its tone budget whichever way it turns from the key:
   * the least and most shares of its skin in the light tone, and in shadow, so a face is mostly its mid tone. */
  face: [number, number, number]; model: [number, number, number, number];
  /** A large surface's least share in shadow, its most in its light tone, and the size (texels at density 1, x density
   * squared past it) from which it counts as large. */
  surface: [number, number, number];
}
export const PAINT: PaintStyle = { tones: [0.62, 0.05, -0.45], line: 0.03, crevice: 0.012, smooth: 1, strands: 0.9, blend: 0.03, shadow: 2, shadowDepth: 0.025, selout: true, bounce: true, cluster: 3, cool: 0.02, folds: 0.15, face: [0.78, 0.22, -0.4], model: [0.06, 0.1, 0.02, 0.08], surface: [0.25, 0.3, 24] };

/**
 * The outside light: each coloured texel's albedo times the light there, snapped to DUEL. A texel the painter filled (no
 * material in g: the neck under the jaw, a designed hand) takes the mean light of the filled texels within 2·D, else the
 * whole figure's. Outline and ink stay as they are.
 */
function lightTexels(light: Float32Array, g: GBuffer, albedo: Uint8ClampedArray, D: number) {
  const { w, h, material } = g, mean = [0, 0, 0];
  let total = 0;
  for (let k = 0; k < w * h; k++) if (material[k] >= 0) { for (let i = 0; i < 3; i++) mean[i] += light[k * 3 + i]; total++; }
  for (let i = 0; i < 3; i++) mean[i] /= total || 1;
  const near = (x: number, y: number) => {
    const sum = [0, 0, 0]; let n = 0;
    for (let yy = Math.max(0, y - 2 * D); yy <= Math.min(h - 1, y + 2 * D); yy++) for (let xx = Math.max(0, x - 2 * D); xx <= Math.min(w - 1, x + 2 * D); xx++) {
      const q = yy * w + xx;
      if (material[q] >= 0) { for (let i = 0; i < 3; i++) sum[i] += light[q * 3 + i]; n++; }
    }
    return n ? sum.map(v => v / n) : mean;
  };
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  for (let k = 0; k < w * h; k++) {
    const o = k * 4, c = (albedo[o] << 16) | (albedo[o + 1] << 8) | albedo[o + 2];
    if (!albedo[o + 3] || c === 0 || c === INK_RGB || c === RAMP_OUTLINE) continue;
    const L = material[k] >= 0 ? [light[k * 3], light[k * 3 + 1], light[k * 3 + 2]] : near(k % w, (k / w) | 0);
    const lit = duel((byte(albedo[o] * L[0]) << 16) | (byte(albedo[o + 1] * L[1]) << 8) | byte(albedo[o + 2] * L[2]));
    albedo[o] = (lit >> 16) & 255; albedo[o + 1] = (lit >> 8) & 255; albedo[o + 2] = lit & 255;
  }
}

// ─── DUEL snapping (OKLab nearest, as scripts/duel-lut.py bakes the lookup) ───
const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export function oklab(rgb: number): [number, number, number] {
  const r = lin((rgb >> 16) & 255), g = lin((rgb >> 8) & 255), b = lin(rgb & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const DUEL = RAMPS.flat().map(c => ({ c, lab: oklab(c) }));
const snapped = new Map<number, number>();
/** A colour's nearest DUEL colour. */
export function duel(rgb: number) {
  let hit = snapped.get(rgb);
  if (hit !== undefined) return hit;
  const [L, A, B] = oklab(rgb);
  let best = Infinity;
  for (const d of DUEL) { const e = (d.lab[0] - L) ** 2 + (d.lab[1] - A) ** 2 + (d.lab[2] - B) ** 2; if (e < best) { best = e; hit = d.c; } }
  snapped.set(rgb, hit!); return hit!;
}
/** The nearest DUEL colour to an OKLab colour. */
function duelLab(L: number, A: number, B: number) {
  let best = Infinity, hit = 0;
  for (const d of DUEL) { const e = (d.lab[0] - L) ** 2 + (d.lab[1] - A) ** 2 + (d.lab[2] - B) ** 2; if (e < best) { best = e; hit = d.c; } }
  return hit;
}
const hex = (h: string) => parseInt(h.slice(1), 16);
/** Two ramps mixed tone by tone, `at` of the way from `from` to `to`: lightness and chroma in OKLab, the hue `to`'s, so
 * a fade's tiers run from the hair's dark into the wearer's own skin (never through a grey or a violet between them, as
 * a mix of the colours would), DUEL-snapped. */
function mixTones(from: number[], to: number[], at: number) {
  return from.map((c, i) => {
    const a = oklab(c), b = oklab(to[Math.min(i, to.length - 1)]), hue = Math.atan2(b[2], b[1]);
    const L = a[0] + (b[0] - a[0]) * at, C = Math.hypot(a[1], a[2]) + (Math.hypot(b[1], b[2]) - Math.hypot(a[1], a[2])) * at;
    return duelLab(L, C * Math.cos(hue), C * Math.sin(hue));
  });
}
/** A material's four painted tones, DUEL-snapped; a blend (`mix`) mixed. */
export function tonesOf(m: Material): number[] {
  if (m.mix) return mixTones(m.mix.from.map(hex), m.mix.to.map(hex), m.mix.at);
  if (m.paint) return m.paint.map(h => duel(hex(h)));
  const row = RAMPS[m.ramp], at = (o: number) => row[Math.max(0, Math.min(7, m.base + o))];
  return [at(1), at(0), at(-1), at(-2)];
}

// ─── Faces: drawn on the lit head, sized from it ───
/** The face's front planes (facePlane's last value: forehead and brow, bridge, each cheekbone's top, chin) and the share
 * of each in the light tone, its brightest: so the light lands on each as a shape of its own, as a pixel artist blocks
 * a face in, and the side of the head (temple, cheek, jaw) is a step down. */
const LIGHT = [0, 0.14, 0.18, 0.12, 0.12, 0.18];
/** The share of a face in its deep tone: none. A sprite's face is flat, its skin mostly the mid with a soft shadow side
 * and a little light on its front planes (`model`, LIGHT); a deep tone on it reads as dirt at sprite size. */
const FACE_DEEP = 0;
/** The head's surface (garments.ts head): the drawn face goes on its skin and nowhere else. */
export const FACE_SEAM = 1000;
/** Hair's seams (hair.ts HAIR_SEAM, and its ropes' own after it): a fringe over an eye is not shades. */
const HAIR_SEAMS = [2000, 3000];
type P = [x: number, y: number];
/** A face's white as one step over the skin's mid (`skinMid`), the same on every skin: the white's own DUEL row's tone
 * nearest `by` over the mid in lightness, so on deep skin it is no brighter than the face's light (the eyes would read
 * as a row of dots) and on light skin as white as its row goes. */
export function eyeWhite(white: number, skinMid: number, by = 0.25) {
  const top = oklab(skinMid)[0] + by, at = onRow(white, -1);
  if (!at) return white;
  let best = white, bd = Infinity;
  for (const c of RAMPS[at[0]]) { const d = Math.abs(oklab(c)[0] - top); if (c !== INK_RGB && d < bd) { bd = d; best = c; } }
  return best;
}
/**
 * A drawn face, placed from the head's projected landmarks and sized from the head in texels, so it is one face at any
 * density: at the brand kit's size each eye a lid line over its iris under the brow, the nose's shadow and the mouth; at
 * twice that each eye's lash line, white and iris, the lid line, brows of the head's own shape, a nose with a lit bridge,
 * a shadow side and nostrils, lips with a darker upper lip and a lit lower one, the shadow under the jaw, the ear's bowl.
 * Its marks are the face's own colours, or steps along the skin's ramp from the painted tone so the key light still models
 * them. It draws on the head's skin alone: hair or a hand over it keep their own texels, and an eye under shades (a part
 * on the face that is neither skin nor hair) is not drawn at all, nor its lid, so no eye shows on the cheek under a lens.
 */
export interface FaceStamp {
  /** 0 front, ±1 three-quarter, ±2 profile, ±3 the back three-quarter (no face drawn); positive looks to the viewer's right. */
  view: number;
  /** The face's half-width (texels): the nose's and the mouth's widths, which are the face's structure. */
  size: number;
  /** An eye's width (texels), the density's size moved by the face's eyeSize (genes.ts): from 3 each has its white, below that
   * a lid line. */
  eye: number;
  /** The eye's width before eyeSize: the face's level of detail (from 3 the white, the lid, the lips' two tones, the nose's
   * lit bridge, the marks), so a small head's narrow eye does not drop its whole face to the small drawing. */
  detail: number;
  /** Projected (texels): the eye line's centre on the face, the eyes (screen-left first), the nose's underside and the
   * lips' line. (The ears are parts of their own: garments.ts ear.) */
  centre: P; eyes: [P, P]; nose: P; mouth: P;
  /** The head's frame in the cell, so the painter finds each face texel on the head's own form: its origin (texels, and
   * depth in m), the cell's texels a metre, the turn from view axes into the head's (row-major: x the figure's left,
   * y up from the chin, z forward), and the head's half-width, height, half-depth and the face's set (genes.faceAhead). */
  frame?: { o: [number, number, number]; ppm: number; R: number[]; head: [number, number, number, number] };
  /** The skin's material index, and the face's colours: iris, lash, the eyes' whites, brow, lips (upper, lower, corner). */
  skin: number; iris: number; lash: number; white: number; brow: number; lips: [number, number, number];
  shape: HeadShape;
  blink: boolean;
  /**
   * The mood's marks (figure.ts face tags): 'angry' the brows' inner ends down and the mouth's corners turned down;
   * 'smile' its corners up; 'dead' the lids heavy over flat eyes (the whites under the lid), the brows level; 'surprised'
   * the brows up; 'mouthOpen' (talking, a shout) the lips parted on the mouth's dark; 'lookL' / 'lookR' the irises to
   * the viewer's left or right, 'beside' the same as 'lookR' at this size (the eye has one texel to move).
   */
  mood?: Set<string>;
}
/**
 * The face's planes, as a pixel artist models a head (not a sphere the key splits down the middle): a texel's normal on
 * the head's own form (`p`, `n` in the head's space: x the figure's left, y up from the chin, z forward) turned toward
 * the plane it lies on. The forehead and the brow ridge face up and forward; the eye sockets under the brow face down,
 * their inner walls toward the nose; the cheekbone's crest faces up and out, the hollow under it down; the muzzle and
 * the forehead's front are flatter than the form; the chin's top faces up (its catch light); the jaw's side plane faces
 * out and down. Each band sits at the head's own landmarks (its cheekbone's height, the eye line) and its strength is
 * the head's structure (the cheekbones' and the jaw's prominence, the chin), so any head gets its planes, and the light
 * lands on them in clusters: the key side's forehead, cheekbone and chin, the far side's cheek and jaw in shadow.
 */
function facePlane(F: HeadShape, hw: number, H: number, p: readonly number[], n: readonly number[]): [number, number, number, number] {
  const t = p[1] / H, u = p[0] / hw, ax = Math.abs(u), sx = u < 0 ? -1 : 1;
  const eyeT = 0.45, browT = eyeT + 0.075, cheekT = 0.33 + 0.1 * F.cheekHeight, noseT = 0.25;
  // Where the front turns into the side: the eyes' outer corners, further out on a broad face.
  const corner = 0.56 + 0.16 * F.width;
  // Each band's share: soft over its edge (a texel or so of the head), so one plane turns into the next over a step, not
  // along a straight cut; the chain takes each plane in turn from what the planes before it leave.
  const over = (v: number, e: number, b = 0.022) => smooth((v - e) / (2 * b) + 0.5), under = (v: number, e: number, b?: number) => 1 - over(v, e, b);
  let x = 0, y = 0, z = 0, left = 1, front = 0, most = 0;
  // `lit`: the front plane (LIGHT's index) whose light this is, and how much of it.
  const take = (m: number, f: [number, number, number], id = 0, lit = 1) => {
    const wt = left * m, l = Math.hypot(...f); x += wt * f[0] / l; y += wt * f[1] / l; z += wt * f[2] / l; left -= wt;
    if (id && wt * lit > most) { most = wt * lit; front = id; }
  };
  // The planes, as a head is blocked in (x out toward its own side, y up, z forward). The side of the head (temple,
  // cheek, jaw) turns only part way from the front, a half-tone; the front's planes (forehead, brow, bridge,
  // cheekbone's top, chin) face forward and up, where the light lands.
  take(over(t, browT + 0.14), [u * 0.5, 0.5, 0.75]);                                                        // the forehead's top, turning back
  take(over(t, eyeT + 0.02) * over(ax, corner + 0.06, 0.05), [sx * 0.7, 0.15, 0.7]);                        // the temple
  take(over(t, browT), [u * 0.3, 0.12, 1], 1);                                                              // the forehead's front
  take(over(t, eyeT + 0.025), [u * 0.35, 0.5, 0.85], 1);                                                    // the brow ridge
  take(over(t, eyeT - 0.055) * over(ax, 0.12, 0.04) * under(ax, corner + 0.1, 0.05), [sx * 0.3 * under(ax, 0.3, 0.05), -0.55, 0.8]); // the socket under it
  take(under(ax, 0.12, 0.03) * over(t, noseT), [0, 0.2 + 0.15 * F.bridge, 1], 2);                           // the bridge
  take(under(ax, 0.24, 0.03) * over(t, noseT) * under(t, eyeT - 0.04), [sx * 0.8, -0.05, 0.6]);             // the nose's side
  take(over(t, cheekT - 0.045) * under(ax, 1.05, 0.05), [sx * (0.3 + 0.15 * F.cheekWidth), 0.55, 0.8], u < 0 ? 3 : 4, under(ax, corner + 0.05, 0.05)); // the cheekbone, up (its front under the eye)
  take(over(t, 0.11) * over(ax, corner, 0.05), [sx * 0.65, -0.25, 0.7]);                                    // the cheek's side
  take(over(t, 0.11) * over(ax, 0.4, 0.05), [sx * 0.35, -0.1 - 0.15 * F.cheekWidth, 0.92]);                 // its front, the hollow
  take(over(t, 0.1), [u * 0.6, -0.05, 1]);                                                                  // the muzzle round the mouth
  take(under(t, 0.035, 0.015), [u * 0.3, -0.75, 0.55]);                                                     // under the jaw
  take(under(ax, 0.45 + 0.1 * F.chin, 0.06), [u * 0.4, 0.35 + 0.15 * F.chin, 0.9], 5);                      // the chin, its top catching
  take(1, [sx * 0.7, -0.3, 0.65]);                                                                          // the jaw's side
  // The facet, and the front plane it lies on (0 none: where the light tone may land) where most of it is one.
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l, most >= 0.5 ? front : 0];
}
/** A facet (facePlane) over the form's own normal `n`, `wf` of it the facet's. */
function onForm(pl: readonly number[], n: readonly number[], wf: number) {
  const X = wf * pl[0] + (1 - wf) * n[0], Y = wf * pl[1] + (1 - wf) * n[1], Z = wf * pl[2] + (1 - wf) * n[2], m = Math.hypot(X, Y, Z) || 1;
  return [X / m, Y / m, Z / m];
}
function stampFace(f: FaceStamp, g: GBuffer, tones: number[], out: Uint8ClampedArray, tone: Int8Array, through: Map<number, number[]>, kept: Uint8Array) {
  const { w, h, material, part, group } = g, view = Math.abs(f.view), d = f.view < 0 ? -1 : 1, F = f.shape, s = f.size;
  if (view >= 3) return;
  const has = (t: string) => !!f.mood?.has(t), angry = has('angry'), smile = has('smile'), dead = has('dead'), open = has('mouthOpen');
  const gaze = has('lookL') ? -1 : has('lookR') || has('beside') ? 1 : 0;
  // Detail by size: from 3 texels an eye has its white and lid, the lips two tones, the nose a lit bridge.
  const big = f.detail >= 3, ew = f.eye, whiteFar = f.white;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const own = (x: number, y: number) => inside(x, y) && part[y * w + x] === FACE_SEAM && material[y * w + x] === f.skin && tone[y * w + x] !== 9;
  const set = (k: number, c: number) => { out[k * 4] = (c >> 16) & 255; out[k * 4 + 1] = (c >> 8) & 255; out[k * 4 + 2] = c & 255; };
  const put = (x: number, y: number, c: number) => { if (own(x, y)) { set(y * w + x, c); kept[y * w + x] = 1; } };
  /** An eye's mark: on the skin, or through a tinted lens (`through`) in its tint, the white faint, the lash dark; an
   * eye behind a lens draws on the lens alone (never half of it on the cheek under it). */
  let behind = false;
  const mark = (x: number, y: number, c: number) => {
    const t = inside(x, y) ? through.get(y * w + x) : undefined;
    if (t) { set(y * w + x, c === f.white || c === whiteFar || (c === f.iris && !big) ? t[2] : t[1]); kept[y * w + x] = 1; }
    else if (!behind) put(x, y, c);
  };
  /** A step along the skin's ramp from the painted tone (+1 a tone darker, −1 lighter). */
  const shade = (x: number, y: number, by: number) => { if (own(x, y)) set(y * w + x, tones[Math.max(0, Math.min(3, tone[y * w + x] + by))]); };
  /** The lid's crease: a step darker, never past the skin's shadow; on deep skin the lit lid a step lighter, so under
   * the brow and over the lash it reads open, not as a fourth dark row. */
  const lightLid = oklab(tones[1])[0] < 0.5;
  /** `soft` steps lighter along the ramp: the hood's line, which at the crease's strength read as a second brow. */
  const lid = (x: number, y: number, soft = 0) => { if (own(x, y)) { const t = tone[y * w + x]; set(y * w + x, tones[lightLid ? Math.max(0, t - 1 - soft) : Math.max(t, Math.min(2 - soft, t + 1))]); } };
  // The eye row: the eye line's, or in profile the near eye's (it sits nearer the camera, so lower under the pitch).
  /** The eyes' tilt: −1 the outer corner a row up (lifted), +1 a row down (drooping), 0 level. */
  const tilt = F.eyeTilt >= 0.75 ? -1 : F.eyeTilt <= 0.25 ? 1 : 0;
  /** The uneven face (asymmetry): the side (+1 the figure's left) whose eye is lowered, 0 under |a| 0.5; the texel a row or a
   * width counts for at this density (two at density 4). Where `big` only. */
  const A = F.asymmetry, lowered = Math.abs(A) >= 0.5 ? Math.sign(A) : 0, dk = f.detail >= 6 ? 2 : 1;
  const near = d > 0 ? f.eyes[0] : f.eyes[1], I = Math.floor(view === 2 ? near[1] : f.centre[1]);
  /** The face's last skin texel from `x` toward `d` on row `y`: its front edge, inside the outline. */
  const edge = (x: number, y: number) => { while (own(x + d, y)) x += d; return x; };
  /** Shades over columns a..b: a part worn on the head that is neither its skin nor its hair (nor a mark), from the
   * brow's row down past the eye's. An eye there is behind them, whatever skin shows round the lens; behind a tinted
   * lens (`through`) it shows, on the lens (`behind`). */
  const shaded = (a: number, b: number) => {
    let worn = false, lens = false;
    for (let y = I - 2; y <= I + 1; y++) for (let x = Math.min(a, b); x <= Math.max(a, b); x++) {
      if (!inside(x, y)) continue;
      const k = y * w + x, p = part[k];
      if (through.has(k)) lens = true;
      else if (material[k] >= 0 && group[k] === GROUP.head && material[k] !== f.skin && p >= 0 && p !== FACE_SEAM && !(p >= HAIR_SEAMS[0] && p < HAIR_SEAMS[1])) worn = true;
    }
    behind = lens;
    return worn && !lens;
  };
  /**
   * An eye: `x0` its left column, `n` texels wide, its outer corner to the `outer` side, the iris's first column `iris`
   * texels in. False when shades cover it (then it has no lid either). Open, as a sprite's eye reads awake: the upper
   * lid's lash over the iris and out to the outer corner (an eye of four, its whole width), the white either side of the
   * iris under it where the iris leaves room.
   */
  const eye = (x0: number, n: number, outer: number, iris: number, side = 0) => {
    // The uneven face (asymmetry): the eye on the lowered side a row lower, and a texel narrower from 0.8, its inner corner kept.
    const low = big && side !== 0 && side === lowered, Y = I + (low ? dk : 0);
    if (low && Math.abs(A) >= 0.8 && n - dk >= 2) { if (outer < 0) x0 += dk; n -= dk; iris = Math.min(iris, n - 1); }
    iris = Math.max(0, Math.min(n - 1, iris + gaze));
    const xo = outer < 0 ? x0 : x0 + n - 1, xin = xo - outer * (n - 1);
    if (shaded(x0 - 1, x0 + n)) return false;
    // Small: the lid line over the eye's width, the iris under it (a closed eye, the line alone, a row down).
    if (!big) { for (let i = 0; i < n; i++) mark(x0 + i, f.blink ? Y : Y - 1, f.lash); if (!f.blink && !(dead && n < 2)) mark(x0 + iris, Y, f.iris); return !behind; }
    // The lid line: a hooded lid's shadow under the brow, or a crease short of the inner corner; a smooth lid has none.
    // One line on the row under the brow, its length the sliders': the hood's from a texel past the outer corner (the
    // whole lid and a texel either side at 1), the crease's from the outer corner, short of the inner one (at 1); the
    // longer of the two is drawn. A dead eye keeps the full hooded line.
    if (behind) {} else if (dead) for (let i = -1; i <= n; i++) lid(x0 + i, Y - 2, 1);
    else {
      const hood = Math.round((n + 2) * F.hood), crease = Math.round(n * F.crease);
      if (hood >= crease) for (let i = 0; i < hood; i++) lid(xo + outer - outer * i, Y - 2, 1);
      else for (let i = 0; i < crease; i++) lid(xo - outer * i, Y - 2);
    }
    // The iris, as a sprite artist draws an eye this size: two texels tall, its pupil dark under the lash and its colour
    // below, two wide in an eye of four; the white beside it on the upper row only, the lower lid the skin. Never
    // further out than the eye's own width.
    const iw = n >= 4 ? 2 : 1, at = Math.max(0, Math.min(n - iw, iris));
    for (let i = 0; i < n; i++) {
      const x = x0 + i, inIris = i >= at && i < at + iw;
      if (f.blink) { mark(x, Y, f.lash); continue; }
      if ((n < 3 || x !== xin || n >= 4) && !(tilt && x === xo)) mark(x, Y - 1, f.lash);
      // Dead eyes: the lid drawn down over the whites, the iris alone staring out under it (its colour, not the pupil row of a live eye).
      if (dead) { if (inIris) mark(x, Y, f.iris); else lid(x, Y); continue; }
      mark(x, Y, inIris ? f.lash : x < x0 + at ? f.white : whiteFar);
      if (inIris) mark(x, Y + 1, f.iris);
    }
    // The lash's flick: a texel past the outer corner, a row down (the upper lid's line turning down at its end); with
    // liner, on the lash's own row.
    // Tilt (eyeTilt): the outer corner's lash and the flick past it a row up when lifted, a row down when drooping.
    if (tilt && !f.blink) mark(xo, Y - 1 + tilt, f.lash);
    if (!f.blink) mark(xo + outer, (F.liner >= 0.5 ? Y - 1 : Y) + tilt, f.lash);
    else if (F.liner >= 0.5) mark(xo + outer, Y, f.lash);
    return !behind;
  };
  /**
   * A brow from its inner end `xi`, `n` texels toward `outer`, at rest (no mood), a clean shape for its gene: straight; a
   * soft arch, on a brow long enough to carry it, or a full arch, one step up from its peak (two thirds out) to its
   * tail, so it rises toward its outer end in a single step (two steps at sprite size read as a scowl or a kink). Never
   * a texel below its head (a drip by the eye reads as a second eye) and never its head raised (that reads worried). A fine brow thins to the skin's deep tone at its tail, a heavy
   * one is two texels thick over its inner half; a high one sits a row up. Over shades (`seen` false) it is one row, and
   * only where a texel of skin parts it from the frame, or it reads as an eye.
   */
  const brow = (xi: number, n: number, outer: number, seen = true) => {
    const B = I - 3 - (big && F.browHeight > 0.4 ? 1 : 0) - (has('surprised') ? 1 : 0), peak = Math.round((n - 1) * 0.67);
    const lift = (t: number) => (!big || t === 0 || dead || angry ? 0 : F.browArch >= 0.7 ? +(t >= peak) : F.browArch >= 0.3 ? +(t >= peak && n >= 6) : 0);
    // Angry: the inner end pulled down toward the nose a row (two at the brand kit's double), the outer end up a row.
    const knit = (t: number) => (!angry ? 0 : t < Math.max(1, Math.round(n * 0.4)) ? 1 : t >= n - 1 && big ? -1 : 0);
    for (let t = 0; t < n; t++) {
      const x = xi + outer * t, y = B - lift(t) + knit(t);
      if (!seen && !own(x, y + 1)) continue;
      const thin = t === n - 1 && (F.browWeight < 0.4 || F.browArch >= 0.3);
      put(x, y, thin ? tones[3] : f.brow);
      if (seen && big && F.browWeight >= 0.7 && t < n * 0.6) put(x, y - 1, f.brow);
    }
  };
  // The nose's underside and the lips' line: the mouth where it projects, the nostrils kept two rows over it (a row of
  // philtrum), and below the eyes.
  const M = Math.max(Math.floor(f.mouth[1]), I + (big ? 6 : 3)), N = Math.max(I + (big ? 3 : 2), Math.min(Math.floor(f.nose[1]), M - (big ? 2 : 1)));
  const nh = Math.max(1, Math.round(s * (0.2 + 0.35 * (F.nose - 0.5)))), mh = Math.max(1, Math.round(s * (0.2 + 0.06 * F.lips)));
  /**
   * The cheek's stroke: on the row under the cheekbone, from the face's edge on the shadow side (the key light comes from
   * the screen's left in every view, so screen +x) inward, two texels a step darker along the skin's ramp: its row the
   * cheekbone's height (`cheekHeight`), never on the nose's columns (`past` the last of them). The cheekbones' width shows
   * by the outline (head.ts), not here. Where `big` only.
   */
  const cheek = (past: number) => {
    const len = 2;
    if (!big) return;
    const y = Math.round(N - (N - I) * (0.4 + 0.5 * F.cheekHeight)) + 1;
    let x = Math.floor(f.centre[0]);
    if (!own(x, y)) return;
    while (own(x + 1, y)) x++;
    for (let i = 0; i < len && x - i > past; i++) shade(x - i, y, 1);
  };
  /** The lit bridge's run down the nose, in rows up from the tip: none at bridge 0, brow to tip at 1. */
  const run = Math.round(F.bridge * (N - 1 - (I + 1)));
  /** The lower lip's rows by the lips slider: the upper lip's line alone under 0.25, two from 0.75, else one (today's). */
  const lipRows = F.lips < 0.25 ? 0 : F.lips < 0.75 ? 1 : 2;
  /** The chin under the mouth at column `x`: its rows of skin below the lips' line. */
  const chin = (x: number) => { let n = 0; while (own(x, M + 1 + n) && n < 4) n++; return n; };
  /**
   * Lips from column a to b: the upper lip dark, its corners the skin two steps down (a lip colour of their own is a
   * fleck); the lower lip lit; the hollow under it at `cm`. A
   * row of the chin's own skin always stays between the lower lip and the jaw's shadow (lips on the jaw's edge read as a
   * goatee): the lower lip only with two rows of chin under the lips' line, the hollow only with three. Parted on a
   * two-row chin: the upper lip and the mouth's dark, no lower lip, so a row of chin stays under the dark. On a small face
   * the mouth's dark keeps a texel of skin at each end, off the jaw's outline.
   */
  const lips = (a: number, b: number, cm: number) => {
    // The uneven face: the mouth's corner on the side away from the lowered eye a row higher (screen-left for +a).
    const upA = big && A >= 0.5, upB = big && A <= -0.5;
    const corner = (x: number) => { if ((x === a && upA) || (x === b && upB)) shade(x, M - 1, 2); else shade(x, M, 2); };
    // The mood at the corners: up a row in a smile, down a row in anger (and closed).
    const corners = (y: number, dark = small || y < M) => { for (const x of [a - 1, b + 1]) if (dark) put(x, y, f.lips[0]); else shade(x, y, 2); };
    const small = !big;
    if (!big) {
      for (let x = a; x <= b; x++) put(x, M, f.lips[0]);
      if (open) {
        // The mouth's dark keeps a texel of the face's own skin between each end and the outline (a mouth that runs into
        // the jaw's outline reads as a wider one): the run shrinks from an end whose neighbour is not skin, to one texel, which steps a texel in off the outline.
        let x0 = Math.min(a + 1, cm), x1 = Math.max(b - 1, cm);
        while (x0 < x1 && !own(x0 - 1, M + 1)) x0++;
        while (x1 > x0 && !own(x1 + 1, M + 1)) x1--;
        // One texel left and still against the outline: it steps in, off it (never to nothing, so talk still shows).
        if (x0 === x1) { if (!own(x0 + 1, M + 1) && own(x0 - 1, M + 1)) x0--; else if (!own(x0 - 1, M + 1) && own(x0 + 1, M + 1)) x0++; x1 = x0; }
        for (let x = x0; x <= x1; x++) put(x, M + 1, f.lash);
      }
      else if (smile) corners(M - 1); else if (angry) corners(M + 1);
      return;
    }
    if (open && chin(cm) >= 3) {
      // Parted: the upper lip, the mouth's dark under it between the corners, the lower lip lit under that.
      for (let x = a; x <= b; x++) if (x === a || x === b) corner(x); else put(x, M, f.lips[0]);
      for (let x = a + 1; x < b; x++) put(x, M + 1, f.lash);
      shade(a, M + 1, 2); shade(b, M + 1, 2);
      for (let x = a + 1; x < b; x++) put(x, M + 2, f.lips[1]);
      return;
    }
    if (open && chin(cm) === 2) {
      for (let x = a; x <= b; x++) if (x === a || x === b) corner(x); else put(x, M, f.lips[0]);
      for (let x = a + 1; x < b; x++) put(x, M + 1, f.lash);
      shade(a, M + 1, 2); shade(b, M + 1, 2);
      return;
    }
    if (smile) corners(M - 1); else if (angry) corners(M + 1);
    const below = chin(cm), rows = lipRows;
    for (let x = a; x <= b; x++) if (x === a || x === b) corner(x); else put(x, M, f.lips[0]);
    // The lower lip's rows (0, 1 or 2 by the slider), each only with a row of the chin's own skin left under it; the
    // hollow under the lip, a row further down the fuller it is.
    // Full lips (the second row's slider end) also take the corners' columns: the lower lip as wide as the mouth.
    if (rows >= 1 && below >= 2) for (let x = a + +(rows < 2); x <= b - +(rows < 2); x++) put(x, M + 1, x === b - 1 && b - a > 3 ? f.lips[0] : f.lips[1]);
    if (rows >= 2 && below >= 3) for (let x = a + 1; x < b; x++) put(x, M + 2, f.lips[1]);
    if (below >= rows + 2) for (let x = cm - 1; x <= cm; x++) shade(x, M + rows + 1, 1);
  };
  if (view === 0) {
    // Symmetric about the centre line, kept to the half texel.
    const c2 = Math.round(f.centre[0] * 2) / 2, mirror = (x: number) => Math.round(2 * c2 - 1 - x);
    const gi = Math.max(1, Math.round((f.eyes[1][0] - f.eyes[0][0]) / 2 - ew / 2));
    // The eyes' inner columns: mirrored about the centre on a face square to the camera; on one turned a little (still
    // this template, up to 22.5°) each at its own projected place, since the far eye foreshortens toward the centre and
    // its mirror lands past the far contour, off the skin, where it is never drawn. Either way each eye is drawn whole
    // on the face: moved in toward the centre while any of its texels on the eye's row is off the skin.
    const turned = Math.abs((f.eyes[1][0] - f.centre[0]) - (f.centre[0] - f.eyes[0][0])) > 0.75;
    const onFace = (x0: number) => { for (let i = 0; i < ew; i++) if (!own(x0 + i, I)) return false; return true; };
    const fit = (x0: number, inward: number) => { for (let s = 0; s <= ew && !onFace(x0); s++) x0 += inward; return x0; };
    const eL = fit(turned ? Math.round(f.eyes[0][0] + ew / 2 - 1) - ew + 1 : Math.floor(c2 - gi - 0.5) - ew + 1, 1);
    const eR = fit(turned ? Math.round(f.eyes[1][0] - ew / 2) : mirror(Math.floor(c2 - gi - 0.5)), -1);
    // Looking ahead: a two-texel iris centred in an eye of four, a white either side; a narrower eye's iris inward.
    const seenL = eye(eL, ew, -1, ew >= 4 ? (ew - 2) >> 1 : ew >> 1, -1), seenR = eye(eR, ew, 1, ew >= 4 ? (ew - 2) >> 1 : (ew - 1) >> 1, 1);
    brow(eL + ew - 1, ew + 1, -1, seenL); brow(eR, ew + 1, 1, seenR);
    // The nose: the bridge lit on the key's side and in shadow on the other, its tip catching the light, the shadow
    // under it and the nostrils darker at its wings (two steps, so they read on deep skin).
    // The uneven face: the nose a texel (two at density 4) off the centre line toward the lowered side.
    const off = big ? Math.round(A * dk) : 0, xc = Math.floor(c2 + 0.5), xr = xc + off, a0 = Math.floor(c2 - nh), a = a0 + off, b = mirror(a0) + off;
    if (big) {
      for (let y = I + 1; y < N - 1; y++) { if (y >= N - 1 - run) shade(xr - 1, y, -1); shade(xr, y, 1); }
      shade(xr - 1, N - 1, -1);
      for (let x = a; x <= b; x++) shade(x, N, x === a || x === b ? 2 : 1);
    } else shade(xr, N, 1);
    cheek(b);
    const ma = Math.floor(c2 - mh);
    lips(ma, mirror(ma), xc);
  } else if (view === 1) {
    // The near eye whole, the far one foreshortened by a texel; both look where the face does.
    // The far eye keeps a texel of cheek between it and the contour, and the near one a texel of the bridge from it.
    const far = d > 0 ? f.eyes[1] : f.eyes[0], nf = Math.max(1, ew - 1), rim = edge(Math.floor(f.centre[0]), I);
    const xn0 = Math.floor(near[0] - ew / 2 + 0.5), xf0 = Math.floor(far[0] - nf / 2 + 0.5), xf = d > 0 ? Math.min(xf0, rim - nf) : Math.max(xf0, rim + 1);
    const xn = d > 0 ? Math.min(xn0, xf - 1 - ew) : Math.max(xn0, xf + nf + 1);
    // Both look where the face does: the iris toward its side of each eye.
    // (Turned to the viewer's right, the screen-left eye is the near one and the figure's right; the other way, the figure's left.)
    const seenN = eye(xn, ew, -d, d > 0 ? ew >> 1 : ew >= 4 ? 0 : (ew - 1) >> 1, -d), seenF = eye(xf, nf, d, d > 0 ? nf - 1 : 0, d);
    brow(d > 0 ? xn + ew - 1 : xn, ew + 1, -d, seenN); brow(d > 0 ? xf : xf + nf - 1, nf + 1, d, seenF);
    // The nose: its ridge from between the eyes to the tip, lit, the shadow beside it; the nostril on the near side.
    const off = big ? Math.round(A * dk) : 0, tip = Math.floor(f.nose[0]) + off;
    if (big) {
      for (let y = I + 1; y < N; y++) { const x = Math.floor(f.centre[0] + (f.nose[0] - f.centre[0]) * (y - I) / (N - I)) + off; if (y < N - 1 && y >= N - 1 - run) shade(x, y, -1); shade(x + 1, y, 1); }
      shade(tip - d, N, 2); shade(tip, N, 1);
    } else shade(tip - d, N, 1);
    cheek(tip + 1);
    const cm = Math.floor(f.mouth[0]);
    // The mouth wider on the near side, its far corner foreshortened: two texels of lip between the corners at least.
    lips(cm - (d > 0 ? mh : Math.max(0, mh - 1)), cm + (d > 0 ? Math.max(0, mh - 1) : mh), cm);
  } else {
    // The eye from the side, a texel in from the face's front: the lash over it, the iris at its front, the white behind.
    // Big: as the front's eye seen edge on, a texel of the lid's skin in front of it: the lash three texels back along
    // the upper lid, the iris two tall at the front (its pupil dark under the lash), the white behind it, the lash's
    // flick down past the outer corner. So a profile keeps an eye that reads, not a fleck by the hairline.
    const xf = edge(Math.floor(f.centre[0]) - 2 * d, I) - (big ? 2 : 1) * d, seen = !shaded(xf - 3 * d, xf + d);
    if (seen && big) {
      // The uneven face: this eye (the figure's right when turned to the viewer's right) a row lower when it is the lowered one.
      const Ip = I + (lowered === -d ? dk : 0);
      if (!behind) for (let i = 0; i < Math.round(3 * Math.max(F.hood, F.crease)); i++) lid(xf - i * d, Ip - 2, +(F.hood > F.crease));
      if (f.blink) { mark(xf, Ip, f.lash); mark(xf - d, Ip, f.lash); mark(xf - 2 * d, Ip, f.lash); }
      else {
        for (let i = 0; i < 3; i++) mark(xf - i * d, Ip - 1, f.lash);
        mark(xf, Ip, f.lash); mark(xf, Ip + 1, f.iris); mark(xf - d, Ip, f.white);
        mark(xf - 3 * d, (F.liner >= 0.5 ? Ip - 1 : Ip) + tilt, f.lash);
      }
    } else if (seen) {
      // Small: the iris and a white behind it on the eye's row, the lash a texel over the iris alone, so under a low
      // hairline it reads as an eye, not one more row of hair.
      if (f.blink) { mark(xf, I, f.lash); mark(xf - d, I, f.lash); } else { mark(xf, I - 1, f.lash); mark(xf, I, f.iris); mark(xf - d, I, f.white); }
    }
    brow(xf + d, big ? 4 : 2, -d, seen && !behind);
    // The nostril's wing behind the tip, which stands off the face.
    shade(Math.floor(f.nose[0]) - (big ? 2 : 1) * d, N, big ? 2 : 1);
    // The lips at the face's front on their rows: the upper dark with the mouth's corner behind it, the lower lit.
    const xm = edge(Math.floor(f.mouth[0]), M); put(xm, M, f.lips[0]);
    if (open) { put(xm, M + 1, f.lash); put(xm - d, M + 1, f.lash); if (big && chin(xm) >= 3) put(edge(Math.floor(f.mouth[0]), M + 2), M + 2, f.lips[1]); }
    else if (smile) shade(xm - 2 * d, M - 1, 2);
    else if (big) {
      shade(xm - d, M, 2); const xl = edge(Math.floor(f.mouth[0]), M + 1);
      if (lipRows >= 1 && chin(xl) >= 2) put(xl, M + 1, f.lips[1]);
      if (lipRows >= 2 && chin(xl) >= 3) put(edge(Math.floor(f.mouth[0]), M + 2), M + 2, f.lips[1]);
    }
  }
}

// ─── Hands: drawn as the face is, from the projected wrist and fingertips ───
/**
 * A hand as a pixel artist draws one at sprite size (the raster's hand is a few texels and loses its thumb), placed from
 * its projected wrist and fingertips and sized from its own cross-section as the view sees it (figure.ts handsAt), so
 * any body, pose and density gets it.
 */
/** A limb group's joints' rest heights (the surface place's y, m) from its root down: the shoulder, the elbow and the
 * wrist; the hip, the knee and the ankle. */
export type Bends = Partial<Record<number, readonly number[]>>;
export interface HandStamp {
  /** The arm's group and the hand's material. */
  group: number; material: number;
  /** Projected (texels, and depth in m): the wrist's middle and the fingertips'. */
  wrist: [number, number, number]; tip: [number, number, number];
  /** The bone in view axes (x right, y up, z toward the camera), wrist to fingertips. */
  axis: [number, number, number];
  /** Half-widths (texels) across the axis at the wrist and at the knuckles, and how far its front stands toward the
   * camera from its middle (m). */
  half: [number, number]; front: number;
  /** Across the axis toward the thumb (texels, y down), and the thumb's span down the hand (fractions of its length). */
  thumb: [number, number]; thumbAt: [number, number];
  /** How far the thumb's side turns toward the camera (−1 away … 1 toward). */
  thumbFacing: number;
  /** The back of the hand's normal, in view axes. */
  back: [number, number, number];
  /** Its fingers point down (a hanging hand); else it holds something (a hip, an arm, a pocket's edge). */
  hangs: boolean;
}
/**
 * The hands, drawn into the painter's G-buffer and toned (`tone`, −1 where no hand): the raster's hand gives way to a
 * designed one, and only where nothing nearer covers it.
 * - The shape: a wrist, a palm a texel broader on the thumb's side from a fifth of the way down, the thumb standing a
 *   texel off the contour over the palm's middle, the fingers to the tips, the tips rounded (and at twice the brand
 *   kit's density parted once, so the fingers read as fingers, not a mitten).
 * - Its tones, in the skin's ramp: the back's edge toward the key its light plane, the knuckle row a step darker under
 *   it with the light's corner kept, the edge away from the key in shadow, a texel of shadow under the thumb's tip.
 * - In a pocket (most of it covered), nothing: only the forearm going into the opening, never a sliver of skin.
 */
function drawHands(hands: HandStamp[], w: number, h: number, D: number, b: { material: Int16Array; part: Int16Array; group: Int16Array; depth: Float32Array; normal: Float32Array; place: Float32Array }): Int8Array {
  const n = w * h, ppm = (96 * D) / 2.6, tone = new Int8Array(n).fill(-1), { material, part, group, depth, normal, place } = b;
  for (const hs of hands) {
    const [wx, wy, wz] = hs.wrist, A3 = [hs.axis[0], -hs.axis[1], hs.axis[2]];
    // The raster's hand: this arm's texels of the hand's material past the wrist.
    const mine: number[] = [];
    let handPart = -1, wristPlace = -1, nearest = Infinity;
    for (let k = 0; k < n; k++) {
      if (material[k] !== hs.material || group[k] !== hs.group) continue;
      const x = k % w, y = (k - x) / w, s = (x + 0.5 - wx) * A3[0] + (y + 0.5 - wy) * A3[1] + (depth[k] - wz) * ppm * A3[2];
      if (s > 0.25) { mine.push(k); if (handPart < 0) handPart = part[k]; }
      else if (-s < nearest) { nearest = -s; wristPlace = k; if (handPart < 0) handPart = part[k]; }
    }
    if (handPart < 0) continue;
    // It gives way to what lies round it and behind it (the cloth it was in front of), or to nothing at the silhouette:
    // a surface nearer than the hand (a trouser's hip, seen from behind the hand) never floods where the hand hung.
    const gone = new Set(mine), was = new Map(mine.map(k => [k, depth[k]]));
    for (let pass = 0; pass < 6 && gone.size; pass++) {
      const fill: [number, number][] = [];
      for (const k of gone) {
        const x = k % w; let best = -1;
        for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w]) if (q >= 0 && q < n && !gone.has(q) && material[q] >= 0 && group[q] !== hs.group && depth[q] < was.get(k)! && (best < 0 || depth[q] < depth[best])) best = q;
        if (best >= 0) fill.push([k, best]);
      }
      if (!fill.length) break;
      for (const [k, q] of fill) { material[k] = material[q]; part[k] = part[q]; group[k] = group[q]; depth[k] = depth[q]; for (let i = 0; i < 3; i++) { normal[k * 3 + i] = normal[q * 3 + i]; place[k * 3 + i] = place[q * 3 + i]; } gone.delete(k); }
    }
    for (const k of gone) { material[k] = -1; part[k] = -1; group[k] = -1; depth[k] = -Infinity; }
    // The axis on screen, straightened when it is within 20° of plumb or level (a hanging hand's columns stay clean).
    let ax = hs.tip[0] - wx, ay = hs.tip[1] - wy, L = Math.hypot(ax, ay);
    if (L < 0.5) { ax = hs.axis[0]; ay = -hs.axis[1]; }
    let ang = Math.atan2(ay, ax);
    const square = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2), snapped = Math.abs(ang - square) < 0.35;
    if (snapped) ang = square;
    const a = [Math.round(Math.cos(ang) * 1e6) / 1e6, Math.round(Math.sin(ang) * 1e6) / 1e6];
    let p = [-a[1], a[0]];
    if (p[0] * hs.thumb[0] + p[1] * hs.thumb[1] < 0) p = [-p[0], -p[1]];
    // Sizes: the wrist as the arm shows it (two texels at least), the knuckles a texel broader from twice the brand
    // kit's density; the length its projection's, a hanging hand's fingers curled short of it (never shorter than the
    // hand is broad).
    const Ww = Math.max(2, Math.round(2 * hs.half[0])), Wk = Math.max(Ww + (D > 1 ? 1 : 0), Math.round(2 * hs.half[1]));
    L = Math.max(L * (hs.hangs ? 0.86 : 1), Wk + 1);
    // The origin on texel edges when straightened, so each column and row is whole.
    let ox = wx, oy = wy;
    if (snapped) {
      const across = Math.abs(p[0]) > 0.5;
      if (across) { ox = Math.round(wx - Ww / 2) + Ww / 2; oy = Math.round(wy); } else { oy = Math.round(wy - Ww / 2) + Ww / 2; ox = Math.round(wx); }
    }
    // Down the hand (rows from the wrist): the wrist, the palm from its flare (a texel broader on the thumb's side), the
    // knuckle row, the fingers; across it (columns, toward the thumb), the little finger's side straight. The thumb over
    // the palm's upper middle, a quarter of the hand long.
    const last = Math.max(3, Math.ceil(L) - 1), sk = Math.round(0.58 * (last + 1)), flare = Math.max(1, Math.round(0.2 * (last + 1)));
    const t0 = Math.max(Math.round(hs.thumbAt[0] * L), flare), t1 = Math.min(t0 + Math.max(1, Math.round(0.26 * L)) - 1, sk - 1);
    const lo = -Ww / 2, kSide = p[0] * K2[0] + p[1] * K2[1] > 0 ? 1 : -1;
    const z = (s: number) => wz + (hs.tip[2] - wz) * Math.min(1, s / L) + hs.front;
    // The thumb shows where it turns to the camera or across the view (from behind, the back of the hand hides it).
    const thumbs = hs.thumbFacing > -0.55;
    // The back of the hand's light: toward the key it has its light plane, turned from it the hand sits a step down.
    const kb = hs.back[0] * KEY[0] + hs.back[1] * KEY[1] + Math.abs(hs.back[2]) * KEY[2], dim = kb < -0.25 ? 1 : 0;
    const role = (s: number, t: number): number => {
      const row = Math.floor(s), col = Math.floor(t - lo), cols = row >= flare ? Wk : Ww;
      if (row < 0 || row > last) return -1;
      const thumb = thumbs && row >= t0 && row <= t1 && col === cols;
      if (col < 0 || (col >= cols && !thumb)) return -1;
      // The tips: the little finger's corner rounded off, and from twice the brand kit's density a notch between the
      // fingers (a broad hand's nearer the thumb, so two fingers' tips and the hand's own read).
      const split = cols <= 3 ? 1 : cols - 2;
      if (row === last && (col === 0 && cols >= 4 || D > 1 && cols >= 3 && col === split)) return -1;
      if (row === last && D === 1 && col === 0) return -1;
      const keyEdge = kSide > 0 ? cols - 1 : 0, farEdge = cols - 1 - keyEdge, thumbEdge = cols - 1;
      const tone = (q: number) => Math.min(2, q + dim);
      // The thumb: its top catching the light where it turns to the key or the camera, its tip a step down; a texel
      // of shadow under its tip where it meets the palm.
      if (thumb) return row === t1 && t1 > t0 ? 2 : row === t0 && (kSide > 0 || hs.thumbFacing > 0.4) ? tone(0) : tone(1);
      if (thumbs && row === t1 + 1 && col === thumbEdge) return 2;
      // The knuckle row a step under the back of the hand, its corner toward the key kept mid.
      if (row === sk) return col === keyEdge ? tone(1) : 2;
      // The back of the hand's plane toward the key: its edge from the flare down, broadening over the knuckles.
      if (row >= flare && row < sk && col === keyEdge && !(thumbs && keyEdge === thumbEdge && row >= t0 && row <= t1 && kSide < 0)) return tone(0);
      if (cols >= 3 && row >= sk - 2 && row < sk && Math.abs(col - keyEdge) === 1 && !dim) return 0;
      // The side away in shadow (below the thumb on its side), and the fingers parted by a line of shadow at D2.
      if (col === farEdge && row > (thumbs && farEdge === thumbEdge ? t1 + 1 : flare)) return 2;
      if (D > 1 && cols >= 3 && row > sk && row < last && col === split) return 2;
      return tone(1);
    };
    // The texels it covers, and how many of them show (nothing nearer there).
    const r = Math.ceil(L + Wk + 2), cx = Math.round(ox), cy = Math.round(oy), cells: [number, number, number][] = [];
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const dx = x + 0.5 - ox, dy = y + 0.5 - oy, s = dx * a[0] + dy * a[1], t = dx * p[0] + dy * p[1], q = role(s, t);
      if (q >= 0) cells.push([y * w + x, q, s]);
    }
    const shows = cells.filter(([k, , s]) => material[k] < 0 || depth[k] < z(s));
    // In a pocket: nothing of it but the wrist at the opening.
    if (shows.length < Math.max(2 * D * D, 0.35 * cells.length)) continue;
    const bn = hs.back[2] < 0 ? hs.back.map(c => -c) : hs.back;
    for (const [k, q, s] of shows) {
      material[k] = hs.material; part[k] = handPart; group[k] = hs.group; depth[k] = z(s); tone[k] = q;
      for (let i = 0; i < 3; i++) { normal[k * 3 + i] = bn[i]; place[k * 3 + i] = wristPlace >= 0 ? place[wristPlace * 3 + i] : 0; }
    }
  }
  return tone;
}

/** A figure's colours: about two dozen, each with a job. */
const PALETTE = 24, MERGE = 0.035, MINOR = [0.075, 0.1, 12] as const;
/**
 * The colour budget, as a pixel artist keeps one: a colour on fewer than 2·D² texels of a larger surface (a fleck of a
 * fourth shadow) takes the nearest colour round it on that surface that has its place, and while the figure has more
 * than `PALETTE` colours the closest pair painted on one material (ΔE under `MERGE`) merge, the rarer into the
 * commoner. The face's own marks (eyes, brows, lips), a gloss's shine and a hologram's ramp (`kept`) are its accents,
 * and stay.
 */
function budget(out: Uint8ClampedArray, w: number, h: number, D: number, kept: Uint8Array, mat: (k: number) => number) {
  const n = w * h, col = new Int32Array(n).fill(-1), count = new Map<number, number>();
  for (let k = 0; k < n; k++) if (out[k * 4 + 3]) { const c = (out[k * 4] << 16) | (out[k * 4 + 1] << 8) | out[k * 4 + 2]; col[k] = c; count.set(c, (count.get(c) ?? 0) + 1); }
  const size = new Map<number, number>();
  for (let k = 0; k < n; k++) if (col[k] >= 0) size.set(mat(k), (size.get(mat(k)) ?? 0) + 1);
  const floor = 2 * D * D, dist = (a: number, b: number) => { const p = oklab(a), q = oklab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  const to = new Int32Array(n).fill(-1);
  for (let k = 0; k < n; k++) {
    const c = col[k], m = mat(k); if (c < 0 || kept[k] || count.get(c)! >= floor || size.get(m)! < floor) continue;
    const x = k % w, y = (k - x) / w; let best = -1, bd = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const q = col[yy * w + xx]; if (q < 0 || q === c || count.get(q)! < floor || mat(yy * w + xx) !== m) continue;
      const d = dist(c, q); if (d < bd) { bd = d; best = q; }
    }
    if (best >= 0) to[k] = best;
  }
  for (let k = 0; k < n; k++) if (to[k] >= 0) { count.set(col[k], count.get(col[k])! - 1); col[k] = to[k]; count.set(to[k], count.get(to[k])! + 1); }
  for (const [c, m] of count) if (!m) count.delete(c);
  // Then a colour still on fewer than 2·D² texels of the whole figure, whatever it is painted on (a buckle's grey, a
  // seam's fleck), is the nearest colour round it that has its place, within a step (ΔE 0.15): no colour is a speck.
  to.fill(-1);
  for (let k = 0; k < n; k++) {
    const c = col[k]; if (c < 0 || kept[k] || count.get(c)! >= floor) continue;
    const x = k % w, y = (k - x) / w; let best = -1, bd = 0.15;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const q = col[yy * w + xx]; if (q < 0 || q === c || count.get(q)! < floor) continue;
      const d = dist(c, q); if (d < bd) { bd = d; best = q; }
    }
    if (best >= 0) to[k] = best;
  }
  for (let k = 0; k < n; k++) if (to[k] >= 0) { count.set(col[k], count.get(col[k])! - 1); col[k] = to[k]; count.set(to[k], count.get(to[k])! + 1); }
  for (const [c, m] of count) if (!m) count.delete(c);
  // The pairs: colours painted on one material, close enough to be one step; and any two the eye cannot part (within
  // `MERGE / 1.2`, two near-blacks of two cloths), whatever they are painted on.
  const on = new Map<number, Set<number>>();
  for (let k = 0; k < n; k++) if (col[k] >= 0 && !kept[k]) { const m = mat(k); let s = on.get(m); if (!s) on.set(m, s = new Set()); s.add(col[k]); }
  const pairs: [number, number, number][] = [];
  for (const s of on.values()) { const cs = [...s]; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const d = dist(cs[i], cs[j]); if (d < MERGE) pairs.push([d, cs[i], cs[j]]); } }
  { const cs = [...new Set([...on.values()].flatMap(s => [...s]))]; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const d = dist(cs[i], cs[j]); if (d < MERGE / 1.2) pairs.push([d, cs[i], cs[j]]); } }
  pairs.sort((a, b) => a[0] - b[0]);
  const into = new Map<number, number>(), root = (c: number): number => { const r = into.get(c); return r === undefined ? c : root(r); };
  let colours = count.size;
  for (const [, a0, b0] of pairs) {
    if (colours <= PALETTE) break;
    const a = root(a0), b = root(b0); if (a === b) continue;
    const [keep, drop] = count.get(a)! >= count.get(b)! ? [a, b] : [b, a];
    into.set(drop, keep); count.set(keep, count.get(keep)! + count.get(drop)!); count.delete(drop); colours--;
  }
  // Still over: a minor tone (under `MINOR[1]` of each material it is painted on, or on small parts only, under
  // `MINOR[2]·D²` texels: a wash's second step, a deep's sliver, a pocket's facing, a chain's fourth grey) joins the
  // nearest colour of the figure within `MINOR[0]`, so the form's own steps (each material's main tones) stay.
  if (colours > PALETTE) {
    const by = new Map<number, Map<number, number>>(), mats = new Map<number, Set<number>>();
    for (let k = 0; k < n; k++) if (col[k] >= 0 && !kept[k]) {
      const m = mat(k), c = root(col[k]); let t = by.get(m); if (!t) by.set(m, t = new Map()); t.set(c, (t.get(c) ?? 0) + 1);
      let s = mats.get(c); if (!s) mats.set(c, s = new Set()); s.add(m);
    }
    /** Of one family: both near-grey, or of hues within 12° and like chroma (a pocket facing may be the jeans' shadow,
     * never a puffer's blue the jeans' violet, nor a buckle's gold the skin's light). */
    const alike = (a: number, b: number) => {
      const p = oklab(a), q = oklab(b), ca = Math.hypot(p[1], p[2]), cb = Math.hypot(q[1], q[2]);
      if (ca < 0.035 && cb < 0.035) return true;
      const dh = Math.abs(Math.atan2(p[2], p[1]) - Math.atan2(q[2], q[1]));
      return Math.min(dh, 2 * Math.PI - dh) < 0.21 && Math.min(ca, cb) > 0.6 * Math.max(ca, cb);
    };
    const minor = (c: number) => [...mats.get(c) ?? []].every(m => (by.get(m)!.get(c) ?? 0) < MINOR[1] * size.get(m)! || size.get(m)! < MINOR[2] * D * D);
    const near: [number, number, number][] = [];
    { const cs = [...mats.keys()]; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const d = dist(cs[i], cs[j]); if (d < MINOR[0] && (minor(cs[i]) || minor(cs[j])) && alike(cs[i], cs[j])) near.push([d, cs[i], cs[j]]); } }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, a0, b0] of near) {
      if (colours <= PALETTE) break;
      const a = root(a0), b = root(b0); if (a === b || !count.has(a) || !count.has(b)) continue;
      const drop = minor(a) && (!minor(b) || count.get(a)! <= count.get(b)!) ? a : minor(b) ? b : -1;
      if (drop < 0) continue;
      const keep = drop === a ? b : a;
      into.set(drop, keep); count.set(keep, count.get(keep)! + count.get(drop)!); count.delete(drop); colours--;
      for (const m of mats.get(drop) ?? []) { const t = by.get(m)!; t.set(keep, (t.get(keep) ?? 0) + (t.get(drop) ?? 0)); t.delete(drop); mats.get(keep)?.add(m) ?? mats.set(keep, new Set([m])); }
      mats.delete(drop);
    }
  }
  for (let k = 0; k < n; k++) {
    if (col[k] < 0) continue;
    const c = kept[k] ? col[k] : root(col[k]);
    out[k * 4] = (c >> 16) & 255; out[k * 4 + 1] = (c >> 8) & 255; out[k * 4 + 2] = c & 255;
  }
}

// ─── The paint pass ───
const isArm = (gr: number) => gr === GROUP.armL || gr === GROUP.armR, isLeg = (gr: number) => gr === GROUP.legL || gr === GROUP.legR;
/** Whether two body regions can lie against each other and want a line between: an arm and the trunk, a hand and a
 * leg, two legs, two arms. The hips are where the legs grow from: none there. */
function touching(a: number, b: number) {
  if (a === b) return false;
  if (a === GROUP.torso || b === GROUP.torso) return isArm(a) || isArm(b);
  return (isArm(a) || isLeg(a)) && (isArm(b) || isLeg(b));
}
/** The cell's texel density: the cast's presets are 36.9 texels a metre at 64 (or 48) texels wide. */
export const densityOf = (w: number) => Math.max(1, Math.round(w / 64));
/** A colour moved in OKLab (lightness, and toward warm or cool) and snapped back to DUEL, a step off `from` at least. */
function shifted(from: number, dL: number, warm: number) {
  const [L, A, B] = oklab(from);
  for (let i = 1; i <= 4; i++) {
    const t = duelLab(L + dL * i, A * (1 + 0.1 * i) + warm * 0.4 * i, B * (1 + 0.1 * i) + warm * i);
    if (t !== from) return t;
  }
  return from;
}
const INK_RGB = duel(hex(INK));
/** Warm: a red, orange, yellow or brown with some colour in it (skin, tan, leather, sticker yellow). Its ramp keeps the
 * hues picked for it, as a cool lean turns skin and browns mauve and yellows olive. */
function warm(c: number) { const [, A, B] = oklab(c), h = Math.atan2(B, A); return Math.hypot(A, B) > 0.02 && h > -0.35 && h < 1.9; }
/** A colour's place on the DUEL rows: its row (`prefer`, the material's own, where it is on it) and step; null off them. */
function onRow(c: number, prefer: number): [number, number] | null {
  const i = RAMPS[prefer]?.indexOf(c) ?? -1;
  if (i >= 0) return [prefer, i];
  for (let r = 0; r < RAMPS.length; r++) { const j = RAMPS[r].indexOf(c); if (j >= 0) return [r, j]; }
  return null;
}
/** A step down a colour's own DUEL row: a darker tone of its own hue, never ink (a row's last step holds). */
function down(c: number, prefer: number) {
  const at = onRow(c, prefer);
  if (!at || at[1] === 0) return c;
  const t = RAMPS[at[0]][at[1] - 1];
  return t === INK_RGB ? c : t;
}
/** The darkest tones short of ink, a black's deepest fold: navy-black, plum-black, neutral (DUEL's teal outline kept out). */
const DARKEST = DUEL.filter(d => d.c !== INK_RGB && d.c !== RAMP_OUTLINE && d.lab[0] < 0.25);
/**
 * The figure's darks: below this lightness a tone is a near-black, and every near-black but ink is one of two: the
 * neutral near-black for a warm or neutral ramp (hair, black cloth, leather), the navy-black for a cool one (cobalt,
 * navy). At 1x five near-blacks of five hues read as mud, and a navy line down black cloth as piping; one ramp's darks
 * are always one family, so a braid is never plum and navy at once.
 */
const NEAR_BLACK = 0.262, DARK_NEUTRAL = 0x1d1d21, DARK_COOL = 0x181f2f;
/** A ramp's deep tone is a near-black a little higher, unless it is a strong colour (a wine's deep keeps its hue): a
 * DUEL row's darkest step (denim's navy, a plum) is then the figure's family dark, not a fifth dark of its own. */
const DEEP_BLACK = 0.29, DEEP_CHROMA = 0.08;
/** Whether a ramp's darks are the cool family: its mid tone leans blue. */
const coolRamp = (tones: number[]) => oklab(tones[1])[2] < -0.03;
/** A tone as its family's near-black, when it is one (`deep`: the ramp's deep step). */
export function darkOf(c: number, cool: boolean, deep = false) {
  if (c === INK_RGB) return c;
  const [L, A, B] = oklab(c);
  return L < NEAR_BLACK || (deep && L < DEEP_BLACK && Math.hypot(A, B) < DEEP_CHROMA) ? (cool ? DARK_COOL : DARK_NEUTRAL) : c;
}
/** A ramp with its near-blacks folded into its family's. */
export function familyTones(tones: number[]) { const cool = coolRamp(tones); return tones.map((c, i) => darkOf(c, cool, i === 3)); }
/** Skin's line: a step down in value from its deep tone (0.045 to 0.1 in lightness), its hue held and its colour no
 * stronger than the deep's (a red or rust line reads as a cut or sunburn at 1x, and a dark one as a crack); on deep
 * skin its own deep is already as dark as a line should go. */
function skinLine(deep: number) {
  const [L, A, B] = oklab(deep), C = Math.hypot(A, B), H = Math.atan2(B, A);
  if (L < 0.35) return deep;
  let best = Infinity, hit = deep;
  for (const d of DUEL) {
    const [l, a, b] = d.lab, c = Math.hypot(a, b);
    if (l > L - 0.045 || l < L - 0.1 || c > C * 0.95) continue;
    const e = (l - (L - 0.065)) ** 2 + 0.01 * (Math.atan2(b, a) - H) ** 2 + 0.5 * (c - C * 0.85) ** 2;
    if (e < best) { best = e; hit = d.c; }
  }
  return hit;
}
/** A ramp leaned cool by `cool` (see PaintStyle.cool) unless it is warm, and lifted off ink: a fill on ink fuses with the
 * outline, so it takes the darkest DUEL tone nearest the ramp's own hue (a black's leaned cool: navy-black). */
const filledTones = new Map<string, number[]>();
function fillTones(tones: number[], cool: number) {
  const key = `${tones.join(',')}|${cool}`; let hit = filledTones.get(key);
  if (hit) return hit;
  const hot = warm(tones[1]);
  const leaned = tones.map((c, i) => { if (i < 2 || !cool || hot) return c; const [L, A, B] = oklab(c), w = cool * (i === 2 ? 0.75 : 1.25); return duelLab(L, A - w * 0.3, B - w); });
  const ref = leaned.filter(c => c !== INK_RGB).map(oklab).sort((a, b) => a[0] - b[0])[0] ?? [0, 0, 0];
  const ra = ref[1], rb = ref[2] - (hot ? 0 : 0.02);
  const lift = DARKEST.reduce((best, d) => ((d.lab[1] - ra) ** 2 + (d.lab[2] - rb) ** 2 < (best.lab[1] - ra) ** 2 + (best.lab[2] - rb) ** 2 ? d : best)).c;
  const isCool = coolRamp(tones);
  hit = leaned.map((c, i) => darkOf(c === INK_RGB ? lift : c, isCool, i === 3));
  filledTones.set(key, hit);
  return hit;
}
/** A dark ramp (black cloth, leather, a black frame): its mid tone this dark. Black has form only in three readable
 * values, so its folds are ink, its lit edge a cool rim and its gloss a tight grey (see extraTones). */
const DARK_MID = 0.34;
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
const LIT_LINE = 0.46, LIT_STEP = 0.16, LIT_FLOOR = 0.24;
function litLine(line: number, deep: number, skin = false) {
  const [L] = oklab(line), [Ld, A, B] = oklab(deep), target = Math.max(LIT_FLOOR, Math.min(L, Ld - LIT_STEP, LIT_LINE));
  if (target >= L - 0.01) return line;
  // Skin's edge a warm brown (its hue turned a little toward orange, its colour no stronger), never a red.
  const C = Math.hypot(A, B), H = Math.atan2(B, A) + (skin ? 0.25 : 0), c = skin ? C * 0.85 : C < 0.015 ? 0 : Math.min(0.12, C * 1.35 + 0.01);
  return duelLab(target, c * Math.cos(H), c * Math.sin(H));
}
const extras = new Map<string, { line: number; fold: number; shine: number; rim: number }>();
function extraTones(tones: number[], ramp: number, skin = false, black = false) {
  const key = `${tones.join(',')}|${ramp}|${skin}|${black}`; let hit = extras.get(key);
  if (!hit) {
    const [L0] = oklab(tones[0]), [Ld] = oklab(tones[3]), dark = black, next = down(tones[3], ramp);
    const fold = skin ? skinLine(tones[3]) : dark ? INK_RGB : Ld > 0.55 && oklab(next)[0] < 0.62 ? tones[3] : darkOf(next, coolRamp(tones));
    const line = dark ? darkOf(next, coolRamp(tones)) : litLine(skin ? fold : Ld > DEEP_BLACK && Ld <= 0.55 ? tones[3] : fold, tones[3], skin);
    const shine = dark ? duelLab(L0 + 0.22, 0, -0.012) : shifted(tones[0], 0.07, 0.008), rim = dark ? duelLab(L0 + 0.08, 0, -0.02) : tones[0];
    hit = { line, fold, shine, rim }; extras.set(key, hit);
  }
  return hit;
}
/** The key in the cell's own axes (x right, y down), toward the light: where a shadow's caster and a lit edge lie. */
const K2 = (() => { const x = KEY[0], y = -KEY[1], l = Math.hypot(x, y); return [x / l, y / l] as const; })();
/** How far a ray toward the key climbs (m) for each metre it runs across the cell. */
const RISE = KEY[2] / Math.hypot(KEY[0], KEY[1]);
/** An outline texel's tone: ink, or (on the key's side of its shape) the shape's own line tone; and a dark ramp's rim. */
const OUTLINE = 9, LINE = 10, RIM = 11;
/** The hair's sheen band: the window of its surface's rise (the normal's y in view space) the band lies in. */
const SHEEN = [0.64, 0.8] as const;
/** A mirror lens's tint (holo `'mirror'`): its body a dark of its ramp's hue, lit and dark, and what shows through it
 * (`see`): an eye's white a muted step of that hue, its iris and lash the tint's dark. The tint's steps sit at MIRROR. */
const MIRROR = 4, MIRROR_SKY = 0.4;
const tints = new Map<string, number[]>();
function tint(ramp: number[]) {
  const key = ramp.join(); let t = tints.get(key);
  if (!t) {
    const [, A, B] = oklab(ramp[3]), c = Math.hypot(A, B) || 1, dark = coolRamp(ramp) ? DARK_COOL : DARK_NEUTRAL;
    tints.set(key, t = [duelLab(0.34, (A / c) * 0.055, (B / c) * 0.055), dark, duelLab(0.45, (A / c) * 0.07, (B / c) * 0.07), dark]);
  }
  return t;
}
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
/** The cloth channel (figure/cloth.ts), for a fabric (fabric.ts): each texel's `(cos t, sin t, v)` as the figure's third raster
 * drew it, and `u(group, cos, sin)`, the metres round the group's cylinder (null for an untiled group). */
export interface Cloth { place: Float32Array; u(group: number, c: number, s: number): number | null }
/** The fabrics of a paint with no cloth channel: none (an index reads undefined), with no array built per call. */
const NO_FABRICS: readonly (Fabric | null)[] = [];
export function paint(g: GBuffer, materials: Material[], albedo: Uint8ClampedArray, normals: Uint8ClampedArray, face: FaceStamp | null, style: PaintStyle = PAINT, skin = face?.skin ?? -1, hands: HandStamp[] = [], bends: Bends = {}, light?: Float32Array, cloth?: Cloth) {
  const { w, h } = g, n = w * h, ink = INK_RGB;
  const tones = materials.map(m => fillTones(tonesOf(m), m.flat ? 0 : style.cool)), D = densityOf(w), ppm = 36.9 * D;
  // The fabrics (H5) of the materials; with no cloth channel, none is read.
  const fabrics = cloth ? materials.map(m => (m.fabric ? fabricOf(m.fabric) ?? null : null)) : NO_FABRICS;
  // The skin's family: the skin, and any surface painted in its tones alone (an ear's rim and bowl), which takes its line.
  const skinSet = new Set(skin >= 0 ? tones[skin] : []), skinny = tones.map((t, i) => i === skin || (skin >= 0 && t.every(c => skinSet.has(c))));
  // Black cloth (a dark ramp, not skin, hair or a flat mark) has its own darks and form (extraTones, the rim below).
  const hairy = (p: number) => p >= HAIR_SEAMS[0] && p < HAIR_SEAMS[1], onHair = new Uint8Array(materials.length);
  for (let k = 0; k < n; k++) if (g.material[k] >= 0 && hairy(g.part[k])) onHair[g.material[k]] = 1;
  const darkRamp = materials.map((m, i) => !m.strands && !m.flat && !skinny[i] && !onHair[i] && oklab(tones[i][1])[0] < DARK_MID);
  const extra = tones.map((t, i) => extraTones(t, materials[i].ramp, skinny[i], darkRamp[i]));
  const stains = materials.map(m => (m.stain ? fillTones(m.stain.paint.map(c => duel(hex(c))), 0) : null));
  // The painter's own copy of the G-buffer's surfaces (the raster's stays as drawn, for the re-shade).
  const material = g.material.slice(), part = g.part.slice(), group = g.group.slice(), depth = g.depth.slice(), normal = g.normal.slice(), place = g.place.slice();
  // The hands, designed (drawHands): their texels' tones are theirs.
  const handTone = drawHands(hands, w, h, D, { material, part, group, depth, normal, place });
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && material[y * w + x] >= 0;
  // The neck under the jaw: a short run of empty texels between the head's skin above and the neck's below (a neck seen
  // from above, the jaw's underside hiding where it meets the head) is the neck in the jaw's shadow, not a hole, so no
  // outline cuts across the throat. It fills from the neck below, and the jaw's crevice shades it.
  if (skin >= 0) for (let x = 0; x < w; x++) for (let y = 1; y < h - 1; y++) {
    const k = y * w + x;
    if (material[k] >= 0 || part[k - w] !== FACE_SEAM || material[k - w] !== skin) continue;
    let e = y; while (e < h - 1 && e - y < 2 * D && material[e * w + x] < 0) e++;
    const q = e * w + x;
    if (material[q] !== skin || part[q] === FACE_SEAM) continue;
    for (let yy = y; yy < e; yy++) {
      const o = yy * w + x;
      material[o] = material[q]; part[o] = part[q]; group[o] = group[q]; depth[o] = depth[q];
      for (let i = 0; i < 3; i++) { normal[o * 3 + i] = normal[q * 3 + i]; place[o * 3 + i] = place[q * 3 + i]; }
    }
  }
  // Normals smoothed within each part, so a part shades as one form: a round brush, wider at higher density (the face's
  // narrower, so its planes survive: brow, cheekbone, jaw).
  const sm = new Float32Array(n * 3), R = Math.round(style.smooth * D);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; if (material[k] < 0) continue;
    let sx = 0, sy = 0, sz = 0;
    const r = part[k] === FACE_SEAM ? Math.max(1, R - 1) : R;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy; if (!filled(xx, yy) || dx * dx + dy * dy > r * r + r) continue;
      // Within the part, and across a join into the same region and cloth at nearly the same depth (an elbow, a knee),
      // so the light runs on through it: a smooth union for the shading.
      const q = yy * w + xx; if (part[q] !== part[k] && !(group[q] === group[k] && material[q] === material[k] && Math.abs(depth[q] - depth[k]) < style.blend)) continue;
      sx += normal[q * 3]; sy += normal[q * 3 + 1]; sz += normal[q * 3 + 2];
    }
    if (sz < 0) { sx = -sx; sy = -sy; sz = -sz; }
    const l = Math.hypot(sx, sy, sz) || 1;
    sm[k * 3] = sx / l; sm[k * 3 + 1] = sy / l; sm[k * 3 + 2] = sz / l;
  }
  // The face on its planes (facePlane): each texel of its skin found on the head's form through the head's frame, its
  // normal turned to its plane, back into view axes (the normal map carries the planes too).
  const isFace = (k: number) => skin >= 0 && part[k] === FACE_SEAM && material[k] === skin;
  // The face is lit in the head's own space, as a sprite's face is: by the key turned toward the face's front (HK), so
  // whichever way it turns, its front planes (forehead, brow, bridge, cheekbone, chin) take the light and the side of
  // the head sits a step down; `facePlaneOf`, the front plane each texel is on (LIGHT).
  const facePlaneOf = new Int8Array(n), faceKeyed = new Float32Array(n);
  if (face?.frame) {
    const { o, ppm: fp, R, head: [hw, H] } = face.frame, F = face.shape;
    const kh = [0, 1, 2].map(i => R[i * 3] * FACE_KEY[0] + R[i * 3 + 1] * FACE_KEY[1] + R[i * 3 + 2] * FACE_KEY[2]);
    const hk = [0.5 * kh[0], 0.5 * kh[1] + 0.1, 0.5 * kh[2] + 0.75], hl = Math.hypot(...hk), HK = hk.map(c => c / hl);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x; if (!isFace(k)) continue;
      const v = [(x + 0.5 - o[0]) / fp, (o[1] - y - 0.5) / fp, depth[k] - o[2]], s = [sm[k * 3], sm[k * 3 + 1], sm[k * 3 + 2]];
      const hp = [0, 1, 2].map(i => R[i * 3] * v[0] + R[i * 3 + 1] * v[1] + R[i * 3 + 2] * v[2]);
      const hn = [0, 1, 2].map(i => R[i * 3] * s[0] + R[i * 3 + 1] * s[1] + R[i * 3 + 2] * s[2]);
      // The light on the facets mostly (so the cheekbone's top takes it as the brow's does), the normal map's on the
      // form half, so a turned head still turns as a whole.
      const pl = facePlane(F, hw, H, hp, hn), kl = onForm(pl, hn, 0.8), pn = onForm(pl, hn, 0.5);
      facePlaneOf[k] = pl[3]; faceKeyed[k] = kl[0] * HK[0] + kl[1] * HK[1] + kl[2] * HK[2];
      for (let c = 0; c < 3; c++) sm[k * 3 + c] = R[c] * pn[0] + R[3 + c] * pn[1] + R[6 + c] * pn[2];
    }
  }
  // A face models in every view: its thresholds are the style's for faces, held to its tone budget (`model`), so turned
  // from the key it still has a light and a shadow side, and turned to it is never all light.
  // The face is lit as a sprite's is: by the key turned part way to the camera (FACE_KEY), so its shadow side is the side
  // turned from both, and a three-quarter face keeps its front in the mid tone rather than splitting at the nose.
  const framed = !!face?.frame;
  const lightOf = (k: number) => (isFace(k) ? (framed ? faceKeyed[k] : sm[k * 3] * FACE_KEY[0] + sm[k * 3 + 1] * FACE_KEY[1] + sm[k * 3 + 2] * FACE_KEY[2]) : sm[k * 3] * KEY[0] + sm[k * 3 + 1] * KEY[1] + sm[k * 3 + 2] * KEY[2]);
  // The face's light blocked in as a pixel artist blocks it: the key on its planes averaged over a texel round from
  // twice the brand kit's density (within the face), so the light lands in shapes (the forehead's, the cheekbone's) and its tones change in clean edges.
  const faceLit = new Float32Array(n);
  if (skin >= 0) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; if (!isFace(k)) continue;
    let s = 0, c = 0;
    for (let dy = 1 - D; dy < D; dy++) for (let dx = 1 - D; dx < D; dx++) {
      const xx = x + dx, yy = y + dy, q = yy * w + xx;
      if (dx * dx + dy * dy > (D - 1) ** 2 + D - 1 || xx < 0 || yy < 0 || xx >= w || yy >= h || !isFace(q)) continue;
      const wt = dx || dy ? 1 : 2; s += lightOf(q) * wt; c += wt;
    }
    faceLit[k] = s / c;
  }
  let faceTh: [number, number, number] | null = null;
  const faceLight = new Uint8Array(n);
  if (skin >= 0) {
    const fs: number[] = [];
    for (let k = 0; k < n; k++) if (isFace(k)) fs.push(faceLit[k]);
    if (fs.length > 8) {
      fs.sort((a, b) => a - b);
      const th = style.face, at = (p: number) => fs[Math.min(fs.length - 1, Math.floor(fs.length * p))];
      const [l0, l1, s0, s1] = style.model;
      const t0 = Math.max(at(1 - l1), Math.min(th[0], at(1 - l0)));
      faceTh = [framed ? Infinity : t0, Math.min(t0 - 0.02, Math.max(at(s0), Math.min(th[1], at(s1)))), FACE_DEEP ? Math.min(th[2], at(FACE_DEEP)) : -Infinity];
      // On a framed face the light tone goes plane by plane (LIGHT): each front plane's brightest share, where it lies
      // in the face's own brightest `2·l1` (so a plane turned from the key, the far cheekbone, stays mid).
      if (framed) {
        const by = LIGHT.map(() => [] as number[]), floor = at(1 - 2 * l1);
        for (let k = 0; k < n; k++) if (isFace(k) && facePlaneOf[k]) by[facePlaneOf[k]].push(faceLit[k]);
        const planeTh = by.map((v, i) => { v.sort((a, b) => a - b); return v.length && LIGHT[i] ? Math.max(floor, v[Math.min(v.length - 1, Math.floor(v.length * (1 - LIGHT[i])))] - 1e-6) : Infinity; });
        for (let k = 0; k < n; k++) if (isFace(k) && facePlaneOf[k] && faceLit[k] >= planeTh[facePlaneOf[k]]) faceLight[k] = 1;
      }
    }
  }
  // The key light on each texel, on its smoothed normal. Hair in clumps along its strands, as the atlas paints it: noise
  // stretched down the hair, fixed to its surface; cloth's fine folds, the same noise (the Nurse's uniform hangs in
  // them). Cloth hangs in folds, not pipes: a noise on its own surface, long down it and on a slant, moves the terminator
  // a texel or two along a sleeve or a leg, so its tone bands run out in tapering wedges and change width as cloth's do
  // (skin and hair keep their form; small parts barely change).
  const lit = new Float32Array(n), grains = new Float32Array(n), P = place;
  // A bare limb (skin on an arm or a leg) is modelled along its bone, not only round it: its light pools a third of the
  // way down each part (the deltoid, the forearm's swell, a hand's knuckles) and falls off to the next joint (the wrist,
  // the fingertips), so a forearm is a form that swells and narrows, not a ribbon of two stripes. `s` runs 0→1 down the
  // part's rest length (limbs hang at rest). A dark ramp's sleeve or leg too: black shows its form by its light alone,
  // so that light wraps round each part and turns away at the joint (the elbow, the knee), its terminator crossing the
  // limb there rather than running down it in three columns.
  const limbSpan = new Map<number, [number, number]>();
  const alongBone = (mi: number) => skinny[mi] || darkRamp[mi];
  for (let k = 0; k < n; k++) if (material[k] >= 0 && alongBone(material[k]) && (isArm(group[k]) || isLeg(group[k]))) {
    const y = P[k * 3 + 1], r = limbSpan.get(part[k]); if (r) { r[0] = Math.min(r[0], y); r[1] = Math.max(r[1], y); } else limbSpan.set(part[k], [y, y]);
  }
  /** How far down its bone a limb's texel lies, 0 at the joint over it to 1 at the next: by the limb's joints (`bends`)
   * where its part lies between them (a sleeve from the shoulder to the wrist turns at the elbow), else down its part. */
  const downBone = (k: number, span: [number, number]) => {
    const j = bends[group[k]], y = P[k * 3 + 1];
    if (j && span[0] >= j[j.length - 1] - 0.02 && span[1] <= j[0] + 0.15) for (let i = 0; i < j.length - 1; i++) if (y >= j[i + 1] || i === j.length - 2) return Math.max(0, Math.min(1, (j[i] - y) / (j[i] - j[i + 1])));
    return (span[1] - y) / (span[1] - span[0]);
  };
  for (let k = 0; k < n; k++) {
    const mi = material[k]; if (mi < 0) continue;
    const m = materials[mi], q3 = k * 3, streaks = m.strands ? style.strands : m.streaks ?? 0;
    let f = isFace(k) ? faceLit[k] : lightOf(k);
    if (streaks) { grains[k] = (noise3(P[q3] * 34, P[q3 + 1] * 9, P[q3 + 2] * 34) - 0.5) * streaks; f += grains[k]; }
    const span = alongBone(mi) ? limbSpan.get(part[k]) : undefined;
    if (span && span[1] - span[0] > 0.01) f += (skinny[mi] ? 0.14 : 0.3) * Math.cos(Math.PI * (downBone(k, span) - 0.3));
    if (style.folds && mi !== skin && !m.strands && part[k] !== FACE_SEAM) f += (darkRamp[mi] ? 0.5 : 1) * (noise3((P[q3] + P[q3 + 1] * 0.6) * 12, P[q3 + 1] * 2.5, (P[q3 + 2] - P[q3 + 1] * 0.4) * 12) - 0.5) * style.folds;
    lit[k] = f;
  }
  /** A surface the painter models as a whole: a garment's or the body's part, in one material (not the face, the hair,
   * a mark or a flat material). */
  const modelled = (k: number) => material[k] >= 0 && part[k] >= 0 && part[k] !== FACE_SEAM && !hairy(part[k]) && !materials[material[k]].flat && !materials[material[k]].strands;
  const surfaceOf = (k: number) => part[k] * 4096 + material[k];
  // Large surfaces model whichever way they turn, as the face does: a garment or a limb of `surface[2]` texels or more
  // (times the density squared) keeps at least `surface[0]` of itself in shadow, its terminator the form's own (its
  // least-lit texels), and at most `surface[1]` in its light tone; so a hoodie turned to the key is never two light tones
  // with no form, and a forearm's light sits on the planes that face the key, not down its length.
  const surfTh = new Map<number, [number, number, number]>();
  {
    const by = new Map<number, number[]>();
    for (let k = 0; k < n; k++) if (modelled(k)) { const key = surfaceOf(k); let a = by.get(key); if (!a) by.set(key, a = []); a.push(lit[k]); }
    for (const [key, fs] of by) {
      // A bare limb's part models whatever its size, so a thin forearm still has its light, mid and shadow.
      if (fs.length < style.surface[2] * D * D && !limbSpan.has(Math.floor(key / 4096))) continue;
      fs.sort((a, b) => a - b);
      const th = materials[key % 4096].tones ?? style.tones, at = (p: number) => fs[Math.min(fs.length - 1, Math.floor(fs.length * p))];
      // A dark ramp's light is a plane of its own, a quarter of it on the side that faces the key (black has three
      // values, and its light is the one that shows its form), its shadow the far third.
      const dk = darkRamp[key % 4096], t1 = Math.max(th[1], at(dk ? 0.3 : style.surface[0])), t0 = dk ? Math.max(t1 + 0.02, at(0.75)) : Math.max(th[0], at(1 - style.surface[1]), t1 + 0.02);
      surfTh.set(key, [t0, t1, Math.min(th[2], t1 - 0.02)]);
    }
  }
  const thOf = (k: number): readonly number[] => (faceTh && material[k] === skin && part[k] === FACE_SEAM ? faceTh : surfTh.get(surfaceOf(k)) ?? materials[material[k]].tones ?? style.tones);
  // Quilting: a sewn chamber (a surface beside another of its group in the same ramp under another name, as garments.ts
  // `chambers` makes a puffer's baffles, and long across its run) is lit as one pillow by its rows across the band: its
  // first rows on the key's side the crest (light where the band faces the key, mid away from it), its body mid or
  // shadow by the band's own light, its last row before the stitch deep. Each baffle then reads as one clean roll over a
  // shadow, varying only in width with the light, never as islands of light where the bumps catch it.
  const band = new Int8Array(n).fill(-9);
  {
    const by = new Map<number, number[]>();
    for (let k = 0; k < n; k++) if (modelled(k)) { let a = by.get(part[k]); if (!a) by.set(part[k], a = []); a.push(k); }
    for (const [p, ks] of by) {
      if (ks.length < 4 * D * D) continue;
      let stitched = 0, mx = 0, my = 0;
      for (const k of ks) {
        const x = k % w, y = (k - x) / w; mx += x; my += y;
        for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w]) if (q >= 0 && q < n && part[q] !== p && modelled(q) && group[q] === group[k] && material[q] !== material[k] && tones[material[q]] === tones[material[k]]) stitched++;
      }
      if (stitched < 2 * D) continue;
      mx /= ks.length; my /= ks.length;
      let sxx = 0, syy = 0, sxy = 0;
      for (const k of ks) { const x = k % w - mx, y = (k - (k % w)) / w - my; sxx += x * x; syy += y * y; sxy += x * y; }
      // The band's run is its long axis; across it (the short one) its rows go from the stitch on the key's side to the next.
      const tr = (sxx + syy) / 2, det = Math.sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy * sxy)), lo = tr - det, hi = tr + det;
      if (hi < lo * 3.2) continue;
      let ux = sxy, uy = lo - sxx;
      if (Math.abs(ux) + Math.abs(uy) < 1e-9) { ux = sxx <= syy ? 1 : 0; uy = sxx <= syy ? 0 : 1; }
      const ul = Math.hypot(ux, uy); ux /= ul; uy /= ul;
      if (Math.abs(ux) > 0.92) { ux = Math.sign(ux); uy = 0; } else if (Math.abs(uy) > 0.92) { ux = 0; uy = Math.sign(uy); }
      if (ux * K2[0] + uy * K2[1] > 0) { ux = -ux; uy = -uy; }
      const th = thOf(ks[0]), gloss = materials[material[ks[0]]].gloss !== undefined;
      for (const k of ks) {
        const x = k % w, y = (k - x) / w;
        let a = 0, b = 0, sum = lit[k], c = 1;
        const at = (i: number) => { const xx = Math.round(x + ux * i), yy = Math.round(y + uy * i); return xx >= 0 && yy >= 0 && xx < w && yy < h && part[yy * w + xx] === p ? yy * w + xx : -1; };
        for (let q = at(-1); q >= 0 && a < 12 * D; q = at(-(++a + 1))) { sum += lit[q]; c++; }
        for (let q = at(1); q >= 0 && b < 12 * D; q = at(++b + 1)) { sum += lit[q]; c++; }
        const fb = sum / c, rows = a + b + 1;
        // A glossy chamber's crest catches the key as one line of shine along its top, where the band faces it.
        band[k] = a < D && rows > D ? (fb > th[0] && a === 0 && gloss ? -1 : fb > th[1] ? 0 : 1) : b === 0 && rows >= 3 ? (D > 1 && rows >= 4 ? 3 : 2) : fb > th[2] ? 1 : 2;
      }
    }
  }
  /** A dark, hard gloss (leather, patent, a black frame): its body stays dark, its light only a thin rim on the key's side
   * of its silhouette, its highlight streaks a texel wide along the crest of its form. */
  const hard = materials.map((m, i) => m.gloss !== undefined && !m.strands && i !== skin && oklab(tones[i][1])[0] < 0.4);
  // Tones: 0 light … 3 deep, −1 a gloss's shine, −2 empty, OUTLINE and LINE. `owner` is the shape an outline texel
  // belongs to (the nearer one): its line tone and its normal.
  const tone = new Int8Array(n).fill(-2), owner = new Int32Array(n).fill(-1), under = new Int8Array(n).fill(2);
  const half = (() => { const v = [KEY[0], KEY[1], KEY[2] + 1], l = Math.hypot(...v); return v.map(c => c / l); })();
  const spec = (k: number) => sm[k * 3] * half[0] + sm[k * 3 + 1] * half[1] + sm[k * 3 + 2] * half[2];
  // A glossy face's sheen: a few texels on the planes that mirror the key best (its top 4%, at most 3·D of them), never
  // a whole plane (its planes are flat, so a sheen by threshold would take one entire).
  let faceSheen = Infinity;
  if (skin >= 0 && materials[skin].gloss !== undefined) {
    const ss: number[] = []; for (let k = 0; k < n; k++) if (isFace(k)) ss.push(spec(k));
    ss.sort((a, b) => b - a); if (ss.length) faceSheen = ss[Math.min(ss.length - 1, Math.floor(Math.min(0.04 * ss.length, 3 * D)))];
  }
  const maxShadow = Math.round(style.shadow * D);
  /** Within `D` rows under the face's skin: the jaw's own shadow band on the neck. */
  const underJaw = (x: number, y: number) => { for (let d = 1; d <= D; d++) if (y - d >= 0 && part[(y - d) * w + x] === FACE_SEAM) return true; return false; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, mi = material[k];
    if (mi < 0) continue;
    const m = materials[mi];
    // Where another group passes in front: this, the far side, takes its outline; a nearer part beside: a crevice tone.
    let line = -1, crevice = false;
    for (let i = 0; i < 4; i++) {
      const xx = x + (i === 0 ? -1 : i === 1 ? 1 : 0), yy = y + (i === 2 ? -1 : i === 3 ? 1 : 0);
      if (!filled(xx, yy)) continue;
      const q = yy * w + xx;
      if (part[q] === part[k] || part[q] < 0 && part[q] !== -2) continue;
      const d = depth[q] - depth[k];
      // One garment over the trunk and the legs (trousers' seat and legs, in one cloth whatever its wash) is one
      // surface: no line where it crosses.
      const cloth = material[q] >= 0 && tones[material[q]] === tones[mi] && (isLeg(group[k]) ? group[q] === GROUP.torso : group[k] === GROUP.torso && isLeg(group[q]));
      if (group[q] !== group[k] && d > style.line && !cloth) { if (line < 0 || depth[q] > depth[line]) line = q; }
      // Where two body regions only touch (an arm hanging against the ribs, the thighs, a hand on the leg), their
      // depths meet: the line runs down the contact, on whichever side sits behind, beside the other's flank (not over
      // a shoulder's or a hip's top, where one grows from the other).
      else if (i < 2 && touching(group[k], group[q]) && (d > 0 || d === 0 && group[k] < group[q]) && Math.abs(sm[k * 3 + 1]) < 0.35 && Math.abs(sm[q * 3 + 1]) < 0.35) { if (line < 0) line = q; }
      else if (d > style.crevice && !(band[k] > -9 && group[q] === group[k] && material[q] >= 0 && tones[material[q]] === tones[mi])) crevice = true;
    }
    if (m.flat || part[k] === -2) { if (line >= 0 && part[k] !== -2) { tone[k] = OUTLINE; owner[k] = line; under[k] = 1; } else tone[k] = 1; continue; }
    const f = lit[k], grain = grains[k], th = thOf(k);
    let t = band[k] > -9 ? band[k] : f > th[0] ? 0 : f > th[1] ? 1 : f > th[2] ? 2 : 3;
    if (t === 1 && faceLight[k]) t = 0;
    if (m.lift !== undefined && m.lift <= 0) t = Math.max(t, 1);
    // A chamber's stitch is its own last row: the next chamber beside it casts no crevice and no shadow on it.
    const quilted = band[k] > -9, stitch = (q: number) => quilted && group[q] === group[k] && material[q] >= 0 && tones[material[q]] === tones[mi];
    if (crevice) t = Math.max(t, 2);
    // The cast shadow: march toward the key; a part of another surface standing above the ray's climb shades this one.
    // The head shades the neck in one band, `D` rows under the jaw's edge, never stacked deeper (a crevice and a cast
    // shadow piled under a short chin read as a beard).
    const neck = mi === skin && part[k] !== FACE_SEAM && group[k] === GROUP.head;
    // The neck is the head's to shade: it sits under the jaw, never in the face's light.
    if (neck) t = Math.max(t, 1);
    for (let d = 1; d <= maxShadow; d++) {
      const xx = Math.round(x + K2[0] * d), yy = Math.round(y + K2[1] * d);
      if (!filled(xx, yy)) continue;
      const q = yy * w + xx;
      if (part[q] === part[k] || part[q] === -2) continue;
      if (neck && part[q] === FACE_SEAM && !underJaw(x, y) || stitch(q)) continue;
      if (depth[q] - depth[k] > style.shadowDepth + RISE * d / ppm) { t = Math.max(t, 2); break; }
    }
    // A gloss mirrors the key where the surface faces halfway between it and the eye (the strands break it on hair): a
    // tight spot, tighter the glossier. A hard one: its shine only on the ridge of that mirror (the texel facing it best
    // across the form, along x or y), so a sleeve's is a streak a texel wide down its crest that holds its place from
    // frame to frame.
    if (m.gloss !== undefined && t <= 1 && band[k] === -9) {
      const sk = spec(k);
      if (hard[mi]) {
        const same = (q: number) => (q >= 0 && q < n && part[q] === part[k] ? spec(q) : NaN);
        const l = same(x > 0 ? k - 1 : -1), r = same(x < w - 1 ? k + 1 : -1), u = same(k - w), dn = same(k + w);
        if (sk > 1 - (1 - m.gloss) * 0.9 && ((sk >= l && sk >= r) || (sk >= u && sk >= dn))) t = -1;
      } else if (isFace(k) ? t === 0 && sk > faceSheen : sk + grain * 0.15 > 1 - (1 - m.gloss) * 0.6) t = -1;
    }
    // An ear (a surface in the skin's own tones but not the skin): the skin's ramp, its rim the mid or the shadow (never
    // the light, nor a gloss's shine: the face's front is where the light lands) and its bowl the one shadow step inside
    // it, so at sprite size it reads as an ear, not a dark or a pale patch.
    if (skinny[mi] && mi !== skin && t !== OUTLINE) t = Math.max(1, Math.min(t, 2));
    // A line texel keeps the tone it would have had (`under`), should its line turn out a stray fleck.
    if (line >= 0) { tone[k] = OUTLINE; owner[k] = line; under[k] = Math.max(t, 2); } else tone[k] = handTone[k] >= 0 ? handTone[k] : t;
  }
  // The hair's sheen band, as a sprite artist paints glossy hair: a ring of the hair's shine round the crown where its
  // surface turns from the top to the side (its normal's rise in a narrow window), broken where the strands part it, on
  // the key's side brighter (its shine) and on the far side its light; never on locks hanging down (a tail, a fringe's
  // fall), which do not rise. Glossy hair alone (a straight or sleek finish, or strands): coils, braids and locs are matte.
  for (let k = 0; k < n; k++) {
    const mi = material[k];
    if (mi < 0 || !hairy(part[k]) || !(materials[mi].sheen || materials[mi].strands) || tone[k] < 0 || tone[k] > 2) continue;
    const nx = sm[k * 3], ny = sm[k * 3 + 1], nz = sm[k * 3 + 2];
    if (nz < 0.05 || ny < SHEEN[0]) continue;
    // Over the band the crown sits a tone down, in the mid, so the ring reads as a ring and not as the top lit whole.
    if (ny > SHEEN[1]) { tone[k] = Math.max(tone[k], 1); continue; }
    if (grains[k] < -0.18) continue;
    tone[k] = nx * K2[0] >= -0.2 ? -1 : 0;
  }
  // The face's tones as a pixel artist cleans them: a texel standing out of its plane (five of its eight neighbours one
  // other tone: a spur, a fleck, a notch in an edge) takes that tone, so its planes meet in clean edges and its shapes
  // keep their size (the drawn face puts its own marks on after). A front plane's light (LIGHT) is a shape drawn on
  // purpose, the bridge's a line: it stays.
  for (let pass = 0; pass < 2; pass++) {
    const was = tone.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const k = y * w + x; if (!isFace(k) || was[k] < 0 || was[k] > 3 || was[k] === 0 && faceLight[k]) continue;
      const count = [0, 0, 0, 0];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = k + dy * w + dx; if ((dx || dy) && isFace(q) && was[q] >= 0 && was[q] <= 3) count[was[q]]++; }
      let best = was[k]; for (let i = 0; i < 4; i++) if (count[i] > count[best]) best = i;
      if (best !== was[k] && count[best] >= 5 && count[was[k]] <= 2) tone[k] = best;
    }
  }
  // Lines run whole: a gap of a texel or two along a line inside the figure (where the contact flickers along a flank)
  // closes, between line texels on one surface drawn for one nearer part, so no line breaks into dashes.
  const lineOn = (q: number, k: number) => q >= 0 && q < n && tone[q] === OUTLINE && material[q] >= 0 && part[q] === part[k];
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const k = y * w + x;
    if (material[k] < 0 || tone[k] === OUTLINE || tone[k] === -2) continue;
    for (const d of [1, w, w + 1, w - 1]) {
      // The line's ends either side, one of them next to this texel.
      const a = lineOn(k - d, k) ? k - d : lineOn(k - 2 * d, k) ? k - 2 * d : -1, b = lineOn(k + d, k) ? k + d : lineOn(k + 2 * d, k) ? k + 2 * d : -1;
      if (a < 0 || b < 0 || (a !== k - d && b !== k + d) || part[owner[a]] !== part[owner[b]]) continue;
      under[k] = Math.max(tone[k], 2); tone[k] = OUTLINE; owner[k] = owner[a];
      break;
    }
  }
  // Stray flecks of line: an interior line still of fewer than a few texels (8-connected, not running into the outline
  // outside) is where two forms only graze; it goes back to its shadow tone whole.
  const minLine = 2 + D, lineSeen = new Uint8Array(n), lineRun: number[] = [], stack: number[] = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (lineSeen[s0] || tone[s0] !== OUTLINE || material[s0] < 0) continue;
    lineRun.length = 0; stack.push(s0); lineSeen[s0] = 1;
    let outside = false;
    while (stack.length) {
      const k = stack.pop()!; lineRun.push(k);
      const x = k % w, y = (k - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (material[q] < 0) { outside = true; continue; }
        if (tone[q] === OUTLINE && !lineSeen[q]) { lineSeen[q] = 1; stack.push(q); }
      }
    }
    if (!outside && lineRun.length < minLine) for (const k of lineRun) { tone[k] = under[k]; owner[k] = -1; }
  }
  // Reflected light: a deep texel on the shadow side's edge (beside the outside, or the line on a far part, away from
  // the key) lifts to shadow, so the form turns before its line and the two darks never double.
  const edgeAt = (x: number, y: number) => !filled(x, y) || tone[y * w + x] === OUTLINE;
  if (style.bounce) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (tone[k] !== 3) continue;
    const away = edgeAt(x + 1, y) || edgeAt(x, y + 1), toward = edgeAt(x - 1, y) || edgeAt(x, y - 1);
    if (away && !toward && (tone[k - 1] === 3 || tone[k - w] === 3)) tone[k] = 2;
  }
  // The clusters, as a pixel artist cleans them: a run of one tone in one part smaller than the cluster size takes the
  // tone its edge touches most (a shine keeps any run of two, a face's plane its light from a run of D, at least two).
  const minSize = style.cluster * D * D, seen = new Uint8Array(n), run: number[] = [], votes = new Int32Array(16);
  for (let s0 = 0; s0 < n; s0++) {
    const t0 = tone[s0];
    if (seen[s0] || t0 < -1 || t0 >= OUTLINE || part[s0] === -2 || materials[material[s0]].flat || handTone[s0] >= 0) continue;
    run.length = 0; stack.push(s0); seen[s0] = 1; votes.fill(0);
    while (stack.length) {
      const k = stack.pop()!; run.push(k);
      const x = k % w, y = (k - x) / w;
      for (let i = 0; i < 4; i++) {
        const q = i === 0 ? (x > 0 ? k - 1 : -1) : i === 1 ? (x < w - 1 ? k + 1 : -1) : i === 2 ? (y > 0 ? k - w : -1) : (y < h - 1 ? k + w : -1);
        if (q < 0 || material[q] !== material[s0] || part[q] !== part[s0]) continue;
        if (tone[q] === t0 && handTone[q] < 0) { if (!seen[q]) { seen[q] = 1; stack.push(q); } }
        else if (tone[q] >= -1 && tone[q] < OUTLINE) votes[tone[q] + 1]++;
      }
    }
    if (run.length >= (t0 === -1 ? Math.min(2, minSize) : t0 === 0 && faceLight[s0] ? Math.max(2, D) : minSize)) continue;
    let best = t0, most = 0;
    for (let i = 0; i < 5; i++) if (votes[i] > most) { most = votes[i]; best = i - 1; }
    if (best !== t0) for (const k of run) tone[k] = best;
  }
  // The detail floor: a fleck of a part's material too small to read as a thing (under 2·D² texels: a heel tab's tip
  // under a hem, a strap's end) in the middle of another's (three quarters of what it touches) is that one's; a mark
  // shorter than D + 1 texels (a woven tag's corner) with no shine of its own goes too. The head's (a stud, a tie) and
  // the skin's keep theirs: an accent there is the face's.
  {
    const islandSeen = new Uint8Array(n), around = new Map<number, number>();
    for (let s0 = 0; s0 < n; s0++) {
      const m0 = material[s0];
      if (islandSeen[s0] || m0 < 0 || m0 === skin || handTone[s0] >= 0 || group[s0] === GROUP.head || hairy(part[s0]) || part[s0] === FACE_SEAM) continue;
      const mark = part[s0] === -2;
      run.length = 0; stack.push(s0); islandSeen[s0] = 1; around.clear();
      while (stack.length) {
        const k = stack.pop()!; run.push(k);
        const x = k % w, y = (k - x) / w;
        for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1]) {
          if (q < 0 || material[q] < 0) continue;
          // A part's fleck is one material; a mark's, every mark it touches (a chain's links alternate their metals).
          if (mark ? part[q] === -2 : material[q] === m0 && part[q] !== -2) { if (!islandSeen[q]) { islandSeen[q] = 1; stack.push(q); } }
          else around.set(q, material[q]);
        }
      }
      if (run.length >= (mark ? D + 1 : 2 * D * D) || (mark && run.some(k => materials[material[k]].gloss !== undefined))) continue;
      const votes = new Map<number, number>();
      for (const mq of around.values()) votes.set(mq, (votes.get(mq) ?? 0) + 1);
      let best = -1, most = 0;
      for (const [mq, c] of votes) if (c > most) { most = c; best = mq; }
      if (best < 0 || (!mark && most < 0.75 * around.size)) continue;
      const host = [...around].find(([, mq]) => mq === best)![0];
      for (const k of run) { material[k] = best; part[k] = part[host]; group[k] = group[host]; if (tone[k] !== OUTLINE) tone[k] = tone[host] === OUTLINE ? under[host] : tone[host]; }
    }
  }
  // The outline outside the figure: each empty texel beside it, owned by its nearest filled neighbour.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (material[k] >= 0) continue;
    let best = -1;
    for (let i = 0; i < 4; i++) {
      const xx = x + (i === 0 ? -1 : i === 1 ? 1 : 0), yy = y + (i === 2 ? -1 : i === 3 ? 1 : 0);
      if (filled(xx, yy) && (best < 0 || depth[yy * w + xx] > depth[best])) best = yy * w + xx;
    }
    if (best >= 0) { tone[k] = OUTLINE; owner[k] = best; }
  }
  // Selective, on the silhouette: an outline texel on the key's side of its shape (the shape lies away from the key)
  // takes the shape's line. A pixel artist decides it per run of the contour, not per texel, or a diagonal beads into
  // ink at every stair: the shape's direction is taken over a wide window (its centroid from the texel, so a stair's
  // corner and its tread agree), averaged along the contour, and a run shorter than `2D + 1` takes its neighbours'.
  if (style.selout) {
    const score = new Float32Array(n).fill(NaN), W = D + 1, minRun = 2 * D + 1;
    const outlined = (q: number) => tone[q] === OUTLINE || tone[q] === LINE;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (tone[k] !== OUTLINE || material[k] >= 0) continue;
      const ownPart = part[owner[k]];
      let gx = 0, gy = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy, q = yy * w + xx;
        if ((dx || dy) && xx >= 0 && yy >= 0 && xx < w && yy < h && material[q] >= 0 && part[q] === ownPart && tone[q] < OUTLINE) { const r2 = dx * dx + dy * dy; gx += dx / r2; gy += dy / r2; }
      }
      const l = Math.hypot(gx, gy);
      score[k] = l > 0 ? -(gx * K2[0] + gy * K2[1]) / l : 0;
    }
    // Along the contour: the mean over the outline of the same shape within W.
    const along = new Float32Array(n).fill(NaN);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x; if (score[k] !== score[k]) continue;
      const ownPart = part[owner[k]];
      let s = 0, c = 0;
      for (let dy = -W; dy <= W; dy++) for (let dx = -W; dx <= W; dx++) {
        const xx = x + dx, yy = y + dy, q = yy * w + xx;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && score[q] === score[q] && part[owner[q]] === ownPart) { s += score[q]; c++; }
      }
      along[k] = s / c;
      if (along[k] > 0.3) tone[k] = LINE;
    }
    // Runs: a short run of line between ink (or of ink between line) along one shape's contour takes the other.
    const runSeen = new Uint8Array(n);
    for (let s0 = 0; s0 < n; s0++) {
      if (runSeen[s0] || along[s0] !== along[s0]) continue;
      const t0 = tone[s0], ownPart = part[owner[s0]];
      run.length = 0; stack.push(s0); runSeen[s0] = 1;
      let other = false;
      while (stack.length) {
        const k = stack.pop()!; run.push(k);
        const x = k % w, y = (k - x) / w;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy, q = yy * w + xx;
          if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h || along[q] !== along[q] || part[owner[q]] !== ownPart || !outlined(q)) continue;
          if (tone[q] !== t0) other = true;
          else if (!runSeen[q]) { runSeen[q] = 1; stack.push(q); }
        }
      }
      // A bare hand's or limb's run is shorter (its lit edge is the skin's line, never ink round a small form).
      if (other && run.length < (skinny[material[owner[s0]]] ? D + 1 : minRun)) for (const k of run) tone[k] = t0 === LINE ? OUTLINE : LINE;
    }
  }
  // Black's form: on a dark ramp the edge inside its lit line is a cool rim (its line alone is as dark as ink), and the
  // texel on the key's side of a fold (ink, a step under its deep) a welt two steps up, so a lapel, a yoke or a sleeve
  // reads as a raised edge over its shadow.
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x, mi = material[k];
    if (mi < 0 || !darkRamp[mi]) continue;
    if (tone[k] >= 0 && tone[k] <= 2) {
      for (const q of [k - 1, k + 1, k - w, k + w]) if (material[q] < 0 && tone[q] === LINE && part[owner[q]] === part[k]) { tone[k] = RIM; break; }
    } else if (tone[k] === OUTLINE) {
      for (const q of [K2[0] < 0 ? k - 1 : k + 1, K2[1] < 0 ? k - w : k + w]) if (material[q] >= 0 && darkRamp[material[q]] && tone[q] >= 0 && tone[q] <= 3) tone[q] = Math.max(0, tone[q] - 2);
    }
  }
  // A stain on fitted cloth (trousers) is a wash, as denim wears: a soft fade on the thighs' fronts and the knees (never
  // the seat, where it would pillow each cheek), an ellipse centred a little below the stain's start and gone by its
  // end, the wash's ramp at the cloth's own tone (no darker ring at its edge), so it fades and never drips; whiskers,
  // short level strokes a texel thick a texel apart, across the hip crease (slanting down and out from the crotch) and
  // the back of the knee, a tone lighter than the cloth around them. 0 none, 1 the edge, 2 the core, 3 a whisker.
  const centre = new Map<number, number>();
  if (stains.some(Boolean)) {
    const sum = new Map<number, [number, number]>();
    for (let k = 0; k < n; k++) if (material[k] >= 0 && stains[material[k]]) { const a = sum.get(part[k]) ?? [0, 0]; a[0] += P[k * 3]; a[1]++; sum.set(part[k], a); }
    for (const [p, [sx, c]] of sum) centre.set(p, sx / c);
  }
  const wash = (k: number, up: number, stain: NonNullable<Material['stain']>) => {
    const q = k * 3, leg = isLeg(group[k]), z = P[q + 2], run = stain.hem - stain.below;
    const facing = smooth(((leg ? z : -z) - 0.015) / 0.05), side = group[k] === GROUP.legL ? 1 : -1;
    // `along` runs outward from the leg's middle; on the seat, from the middle of either side of it.
    const dx = P[q] - (centre.get(part[k]) ?? P[q]), along = leg ? dx * side : Math.abs(dx) - 0.085;
    // The fade's oval: longer below its middle than above, narrowing away from the cloth's middle line.
    const v = smooth(1 - (up < 0.7 ? (0.7 - up) / 0.4 : (up - 0.7) / 0.75)) * smooth(1 - Math.abs(along) / 0.11);
    if (leg) {
      // Whiskers: their rows across the stroke (one every three texels), each a few texels long where the noise lets it;
      // at the hip from the crotch side of the thigh's front.
      const stroke = (c: number, zone: boolean, salt: number, odds: number) => {
        if (!zone) return false;
        const at = c * ppm / 3 + 0.5, row = Math.floor(at);
        return at - row < 0.34 && noise3(row * 1.7 + salt, along * ppm / 7, part[k] * 0.37) > odds;
      };
      if (stroke(P[q + 1] - stain.hem + 0.35 * along, up > 0.22 && up < 0.6 && facing > 0.3 && along < 0.03, 0, 0.47)) return 3;
      const knee = stain.below - 0.26 * run;
      if (stroke(P[q + 1] - knee, Math.abs(P[q + 1] - knee) < 0.04 && smooth(-z / 0.04) > 0.5, 11, 0.56)) return 3;
    }
    const s = v * facing + (noise3(P[q] * 9, P[q + 1] * 6, P[q + 2] * 9) - 0.5) * 0.4;
    // The seat only ever half fades: worn, never a spotlight.
    return s > 0.6 && leg ? 2 : s > 0.4 ? 1 : 0;
  };
  // Iridescence: a holo surface (a part, or a material's marks together) ranks its texels by their light and their turn
  // across the view, and lays its ramp over them in that order, a quarter each: the most turned to the key and the
  // eye its first (cyan) step, the least its last (violet); its shadow never brighter than its third step.
  const hue = new Int8Array(n).fill(-1), through = new Map<number, number[]>();
  if (materials.some(m => m.holo)) {
    const by = new Map<number, number[]>();
    for (let k = 0; k < n; k++) {
      const mi = material[k]; if (mi < 0 || !materials[mi].holo || tone[k] < 0 || tone[k] >= OUTLINE) continue;
      const key = part[k] >= 0 ? part[k] * 4096 + mi : -1 - mi; let a = by.get(key); if (!a) by.set(key, a = []); a.push(k);
    }
    const phase = (k: number) => lit[k] + 0.6 * sm[k * 3] - 0.3 * sm[k * 3 + 1];
    for (const ks of by.values()) {
      ks.sort((a, b) => phase(b) - phase(a));
      if (materials[material[ks[0]]].holo !== 'mirror') { ks.forEach((k, i) => { hue[k] = Math.max(Math.min(3, Math.floor((i / ks.length) * 4)), tone[k] >= 2 ? 2 : 0); }); continue; }
      // A mirror: each lens (a connected run of it) is its tint, lit on the key's side of its middle (MIRROR + 0) and
      // dark past it (+ 1); its top row reflects the sky on the key's side alone, its ramp laid along it from the key's
      // end (at most `MIRROR_SKY` of the row and D + 1 texels: an edge, never a visor across it); its glint, a texel of its
      // first step under that edge's key end where the lens has the rows.
      const mine = new Set(ks), lensSeen = new Set<number>(), toKey = K2[0] < 0 ? -1 : 1;
      for (const k0 of ks) {
        if (lensSeen.has(k0)) continue;
        const lens: number[] = [k0]; lensSeen.add(k0);
        for (let i = 0; i < lens.length; i++) for (const q of [lens[i] - 1, lens[i] + 1, lens[i] - w, lens[i] + w]) if (mine.has(q) && !lensSeen.has(q)) { lensSeen.add(q); lens.push(q); }
        const xs = lens.map(k => k % w), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
        for (const k of lens) hue[k] = MIRROR + +((k % w - mid) * toKey < 0);
        const top = lens.filter(k => !mine.has(k - w)).sort((a, b) => (b % w - a % w) * toKey);
        const sky = Math.min(Math.ceil(top.length * MIRROR_SKY), D + 1);
        top.slice(0, sky).forEach((k, i) => { hue[k] = Math.min(3, Math.floor((i / sky) * 3)); });
        const glint = top[0] + w;
        if (top.length && mine.has(glint) && lens.length >= 6 * D) hue[glint] = 0;
      }
    }
  }
  for (let k = 0; k < n; k++) {
    const o = k * 4, t = tone[k];
    if (t === -2) { albedo[o + 3] = 0; normals[o] = 128; normals[o + 1] = 128; normals[o + 2] = 255; normals[o + 3] = 0; continue; }
    // A line inside the figure is the far surface's own (its fold, its normal); one outside, its shape's.
    const at = t >= OUTLINE && material[k] < 0 ? owner[k] : k, mi = material[at];
    let ramp = tones[mi];
    const stain = materials[mi].stain;
    let tt: number = t;
    if (stain && t < OUTLINE) {
      const q = k * 3, up = (P[q + 1] - stain.hem) / (stain.below - stain.hem), gr = group[k];
      if (isLeg(gr) || gr === GROUP.torso) {
        const worn = isLeg(gr) ? wash(k, up, stain) : 0;
        if (worn) { ramp = stains[mi]!; tt = worn === 3 ? Math.max(Math.min(t, 3) - 1, 0) : t; }
      // On hanging cloth (a skirt's hem): surely at the hem, ever less often up to its top, in runs that climb (noise
      // tall in y, fine across), on the cloth's own surface so it never swims.
      } else if (up < 1 && noise3(P[q] * 34, P[q + 1] * 5, P[q + 2] * 34) > Math.max(0, up) ** 0.7 * 0.85) ramp = stains[mi]!;
    }
    if (hue[k] >= MIRROR) { ramp = tint(ramp); tt = hue[k] - MIRROR; } else if (hue[k] >= 0) tt = hue[k];
    // Lit from outside: the key's bands are gone, so a light or dark key tone reads mid (3 deep stays).
    else if (light && t >= 0 && t <= 2) tt = 1;
    // A fabric's tile (H5): a step along the material's own ramp by the tile's label, on cloth's own surface only. Not shine,
    // a line, the rim or the outline; not a holo hue, a mark or a print, a hand, or a texel the painter refilled (the
    // cloth channel follows the raster's surface, not the painter's copy). The head and held items have no cylinder.
    const fab = fabrics[mi];
    if (fab && t >= 0 && t <= 3 && hue[k] < 0 && at === k && part[k] >= 0 && part[k] === g.part[k] && material[k] === g.material[k] && handTone[k] < 0) {
      const u = cloth!.u(group[k], cloth!.place[k * 3], cloth!.place[k * 3 + 1]);
      if (u !== null) tt = Math.max(0, Math.min(ramp.length - 1, tt - labelAt(fab, u, cloth!.place[k * 3 + 2], ppm)));
    }
    if (materials[mi].see && t < OUTLINE && (hue[k] >= MIRROR || materials[mi].holo !== 'mirror')) through.set(k, tint(tones[mi]));
    const c = t === OUTLINE ? (at === k ? extra[mi].fold : ink) : t === LINE ? extra[mi].line : t === RIM ? extra[mi].rim : t === -1 ? extra[mi].shine : ramp[Math.min(tt, ramp.length - 1)];
    albedo[o] = (c >> 16) & 255; albedo[o + 1] = (c >> 8) & 255; albedo[o + 2] = c & 255; albedo[o + 3] = 255;
    normals[o] = Math.round((sm[at * 3] + 1) * 127.5); normals[o + 1] = Math.round((1 - sm[at * 3 + 1]) * 127.5); normals[o + 2] = Math.round((sm[at * 3 + 2] + 1) * 127.5); normals[o + 3] = 255;
  }
  // The face reads the tones: an outline texel (9) is never the face's.
  const fixed = tone.map(v => (v >= OUTLINE ? 9 : v));
  const kept = new Uint8Array(n);
  for (let k = 0; k < n; k++) if (tone[k] === -1 || hue[k] >= 0) kept[k] = 1;
  if (face) stampFace(face, { ...g, material, part, group, depth }, tones[face.skin], albedo, fixed, through, kept);
  budget(albedo, w, h, D, kept, (k: number) => material[tone[k] >= OUTLINE && material[k] < 0 ? owner[k] : k]);
  if (light) lightTexels(light, g, albedo, D);
  return { albedo, normals };
}
