import { J, type Skeleton } from '../body/rig';
import { add, axisAngle, clamp, cross, dot, hash, lerp, normalize, scale, smooth, sub, type V3 } from '../../lib/math';
import { reach, superquadric, type Decal, type Material, type Mesh, type Part } from '../body/parts';
import type { Measure } from '../body/genes';
import { FACE_SEAM, tonesOf } from '../paint/paint';
import { RAMPS } from '../paint/duel-ramps';
import { hexOf } from '../../lib/colour';
import hairLibrary from './library/hair.json';
import { headAt, headForm, headNormal, insideHead, type HeadForm } from '../body/head';
/**
 * Hair generators (library/hair.json). A style is a list of pieces fitted to the
 * skull in head units: angles round it from the front (rad, + toward the figure's left, mirrored), heights of its
 * half-height about its middle (−1 the chin … 1 the crown), sizes of its half-width; so any head the sliders make
 * wears it. The pieces:
 *
 * - scalp: a shell on the skull from a hairline up to the crown, or a band between two lines (a fade), lifted off it,
 *   fuller at the crown and ridged the way the hair is combed, so its sheen breaks into bands along the strands.
 * - rows: ropes laid on the scalp from the hairline to a point: braids gathered up into a pony, cornrows to the nape.
 * - tail: a ponytail's ropes, rising from the crown and falling down the back, clear of the body, to below the shoulders.
 *
 * A fork adds pieces of its own (registerHairPiece, built from HairCtx's helpers) and finishes (registerFinish); base
 * registers none.
 *
 * Every piece is one surface (seam 2000) unless it is ropes whose gaps must show: each rope is then its own part, so
 * the painter's crevice falls where one passes over another and the ground between them, and the beads along a rope
 * (the plait) are its own form, lit on top and dark under, so they alternate light and dark at any density.
 */
export const HAIR_SEAM = 2000;
/** The tag on the hair's top surface over the crown: where anything worn up on the head lies. */
export const CROWN = 'crown';
/**
 * The skull's frame: a rounded box round the lofted head (garments.ts head), its centre, radii, roundness and taper.
 * A style's head units (heights, angles round it, sizes of its half-width) are about it; what fits the head (a scalp, a
 * row's line, a fall's root) fits the head's own form (head.ts headForm; here onHead, toHead), so a style
 * hugs the round cranium, never a box round it.
 */
export interface Skull { c: V3; r: V3; e: [number, number]; taper: [number, number] }
export function skull(s: Skeleton): Skull {
  const g = s.genes, hw = g.head * g.headWidth / 2, hd = g.head * g.headDepth / 2;
  return { c: [0, g.head * 0.5, hd * (g.faceAhead - 0.15)], r: [hw * 1.04, g.head * 0.5, hd * 1.15], e: [0.6, 0.65], taper: [0.9, 1] };
}
const sp = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;
/** A point on the skull at angle `a` and height `y`, `lift` of its radius off it. */
export function onSkull(k: Skull, a: number, y: number, lift = 0): V3 {
  const yy = clamp(y, -1, 1), u = Math.asin(sp(yy, 1 / k.e[0])), v = Math.PI / 2 - a, cu = sp(Math.cos(u), k.e[0]);
  const tk = lerp(k.taper[0], k.taper[1], (yy + 1) / 2), f = 1 + lift;
  return [k.c[0] + cu * sp(Math.cos(v), k.e[1]) * k.r[0] * tk * f, k.c[1] + yy * k.r[1] * f, k.c[2] + cu * sp(Math.sin(v), k.e[1]) * k.r[2] * tk * f];
}
/** Where the ray from the skull's centre along `d` leaves the head's own form, `lift` of the skull's half-width beyond
 * (bisection on its inside test): a row's path, a bun's or a tail's root. */
export function toHead(f: HeadForm, k: Skull, d: V3, lift = 0): V3 {
  const n = normalize(d);
  let lo = 0, hi = 2 * f.h;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (insideHead(f, add(k.c, scale(n, m)))) lo = m; else hi = m; }
  return add(k.c, scale(n, lo + lift * k.r[0]));
}
/** A lit streak's width along it (`u` 0 its root … 1 its tip, 0 outside): a spindle, full a little root-ward of its
 * middle and tapering to a point at either end, as a pixel artist draws a strand's shine, never a bar. */
const spindle = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u ** 0.8) ** 0.6);
/** A line round the skull: knots of [angle from the front, height], mirrored, eased between. */
export type Line = [number, number][];
export function along(line: Line, a: number) {
  const x = Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  if (x <= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i++) if (x <= line[i][0]) {
    const [a0, y0] = line[i - 1], [a1, y1] = line[i];
    return lerp(y0, y1, smooth((x - a0) / (a1 - a0 || 1)));
  }
  return line[line.length - 1][1];
}

// ─── Meshes ───
/** A grid of points into a mesh: normals from its neighbours, turned away from `inner` (a point, per row, inside it). */
export function grid(rows: number, cols: number, at: (i: number, j: number) => V3, wrap: boolean, inner: (i: number) => V3, skip?: (i: number, j: number) => boolean): Mesh {
  const P: V3[][] = [];
  for (let i = 0; i <= rows; i++) { const row: V3[] = []; for (let j = 0; j < cols; j++) row.push(at(i, j)); P.push(row); }
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const get = (i: number, j: number) => P[clamp(i, 0, rows)][wrap ? (j + cols) % cols : clamp(j, 0, cols - 1)];
  for (let i = 0; i <= rows; i++) for (let j = 0; j < cols; j++) {
    // A pole (a row pinched to a point) takes its tangent from the row beside it.
    let du = sub(get(i + 1, j), get(i - 1, j)), dv = sub(get(i, j + 1), get(i, j - 1));
    if (Math.hypot(...dv) < 1e-7) dv = sub(get(i === 0 ? 1 : i - 1, j + 1), get(i === 0 ? 1 : i - 1, j - 1));
    let n = normalize(cross(dv, du));
    const p = P[i][j];
    if (dot(n, sub(p, inner(i))) < 0) n = scale(n, -1);
    positions.push(...p); normals.push(...n);
  }
  const id = (i: number, j: number) => i * cols + (wrap ? j % cols : j);
  for (let i = 0; i < rows; i++) for (let j = 0; j < (wrap ? cols : cols - 1); j++) {
    if (skip?.(i, j)) continue;
    indices.push(id(i, j), id(i, j + 1), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i + 1, j));
  }
  return { positions, normals, indices };
}
/** A smooth path through control points (Catmull-Rom), resampled to `n + 1` points evenly along its length. */
export function spline(points: V3[], n: number): V3[] {
  const pts = [points[0], ...points, points[points.length - 1]], dense: V3[] = [];
  for (let s = 1; s < pts.length - 2; s++) for (let i = 0; i < 24; i++) {
    const t = i / 24, [p0, p1, p2, p3] = [pts[s - 1], pts[s], pts[s + 1], pts[s + 2]], t2 = t * t, t3 = t2 * t;
    dense.push([0, 1, 2].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)) as V3);
  }
  dense.push(points[points.length - 1]);
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(...sub(dense[i], dense[i - 1])));
  const out: V3[] = [], total = len[len.length - 1] || 1;
  for (let i = 0, d = 0; i <= n; i++) {
    const want = total * i / n;
    while (d < dense.length - 2 && len[d + 1] < want) d++;
    const k = (want - len[d]) / (len[d + 1] - len[d] || 1);
    out.push([0, 1, 2].map(c => lerp(dense[d][c], dense[d + 1][c], clamp(k, 0, 1))) as V3);
  }
  return out;
}
/** A rope's make: its radius (of the skull's half-width), how flat it is (its depth over its width), how square, and
 * its texture: `beads` along it (a plait, `depth` deep), `ridges`
 * along it (strands), its ends. */
export interface Rope {
  r: number; flat?: number; e?: number;
  /** `pitch`: in place of a count, each bead this long (of the unit), so ropes of one make bead alike whatever their
   * length. `plait`: the upper half of each bead in the lit tone, its edge a V dipping this much of a bead down the
   * rope's middle (the strands crossing in from either side), so a braid reads as a plait down its axis; false keeps
   * one tone (locs). */
  beads?: number; pitch?: number; depth?: number; ridges?: [number, number]; plait?: number | false;
  /** Where along it its beads start (of a bead), and how far they slant across it (of a bead, edge to edge): a plait's
   * strands cross it on a diagonal, so the light on each bead is a slanted stroke, and ropes laid side by side with
   * their phases apart and their slants turned against each other read as a herringbone, never as rungs. */
  phase?: number; slant?: number;
  /** Streaks of the lit tone along it, across the side its depth faces (a quiff's sheen, a loc's lit edge): how many,
   * from and to (of its length, each streak's ends jittered), and how wide (of its share, either side; a third). */
  streaks?: [number, number, number, number?];
  tip?: 'point' | 'round' | 'blunt'; root?: number; taper?: number;
  /** Faces round its section (10): a wide mass wants more, so its streaks and ridges are fine. */
  seg?: number;
}
/**
 * A tube along a path, its section an (super)ellipse `a` across and `b` deep (metres, scaled along it by the rope's
 * ends), turned so its depth faces `out` at each point. Returns the mesh and each vertex's share of the way along.
 */
export function sweep(path: V3[], rope: Rope, unit: number, out: (p: V3, t: number) => V3, rings = 0): { mesh: Mesh; lit?: Mesh; t: number[] } {
  const total = path.reduce((l, p, i) => (i ? l + Math.hypot(...sub(p, path[i - 1])) : 0), 0);
  const a0 = rope.r * unit, b0 = a0 * (rope.flat ?? 1), e = rope.e ?? 1, depth = rope.depth ?? 0.25;
  const beads = rope.pitch ? Math.max(2, Math.round(total / (rope.pitch * unit))) : rope.beads ?? 0;
  const n = rings || Math.max(8, Math.ceil(total / (a0 * 0.5)), beads * 6), seg = rope.seg ?? 10, P = spline(path, n);
  const T = P.map((_, i) => normalize(sub(P[Math.min(n, i + 1)], P[Math.max(0, i - 1)])));
  const root = rope.root ?? 0.06, tip = rope.tip ?? 'round', taper = rope.taper ?? 1;
  const tipLen = tip === 'point' ? 0.25 : tip === 'round' ? Math.min(0.5, a0 / (total || 1)) : Math.min(0.5, a0 * 0.15 / (total || 1));
  const profile = (t: number) => {
    const r = t < root ? Math.sqrt(1 - (1 - t / root) ** 2) : 1, q = (t - (1 - tipLen)) / tipLen;
    const end = q <= 0 ? 1 : tip === 'point' ? (1 - q) ** 1.3 : Math.sqrt(Math.max(0, 1 - q * q));
    return r * end * lerp(1, taper, t);
  };
  const frame = (i: number) => {
    const t = T[i], o = out(P[i], i / n), N = normalize(sub(o, scale(t, dot(o, t)))), B = cross(t, N);
    return { N, B };
  };
  const F = P.map((_, i) => frame(i));
  // The beads' count along it at (t, θ): its phase, and its slant across the face its depth turns to (cos θ runs across it).
  const phase = rope.phase ?? 0, slant = rope.slant ?? 0, bead = (t: number, th: number) => beads * t + phase - slant * 0.5 * Math.cos(th);
  const at = (i: number, j: number): V3 => {
    const t = i / n, th = 2 * Math.PI * j / seg, f = profile(t);
    let m = 1;
    if (beads) m += depth * (2 * Math.abs(Math.sin(Math.PI * bead(t, th))) ** 0.7 - 1);
    if (rope.ridges) m += rope.ridges[1] * Math.cos(rope.ridges[0] * th);
    const c = sp(Math.cos(th), e) * a0 * f * m, s = sp(Math.sin(th), e) * b0 * f * m, { N, B } = F[i];
    return add(P[i], add(scale(B, c), scale(N, s)));
  };
  // The plait: the upper half of every bead lit, its edge a V down the middle, so the light runs down the rope in chevrons.
  const plait = beads && rope.plait !== false ? rope.plait ?? 0.35 : null;
  const streaks = rope.streaks, lit = plait !== null
    ? (i: number, j: number) => { const th = 2 * Math.PI * (j + 0.5) / seg, b = bead((i + 0.5) / n, th) - (slant ? 0 : plait * (1 - Math.abs(Math.cos(th)))); return b - Math.floor(b) < 0.5; }
    : streaks ? (i: number, j: number) => {
      // Across the outer face (θ from 0 to π), `count` streaks evenly, each up to `width` of its share either side,
      // tapering to points along the rope (spindle).
      const th = 2 * Math.PI * (j + 0.5) / seg, q = th / Math.PI * streaks[0] - 0.5, at = Math.round(q), t = (i + 0.5) / n, r = (hash(at * 31 + 7) - 0.5) * 0.25;
      const lo = streaks[1] + r, hi = streaks[2] + r;
      return th < Math.PI && Math.abs(q - at) < (streaks[3] ?? 0.34) * spindle((t - lo) / (hi - lo));
    } : undefined;
  const mesh = grid(n, seg, at, true, i => P[i], lit);
  const ts: number[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j < seg; j++) ts.push(i / n);
  return { mesh, lit: lit && grid(n, seg, at, true, i => P[i], (i, j) => !lit(i, j)), t: ts };
}

// ─── The pieces ───
/** A piece's colour: the hair, its lit tone (a plait's, a streak's, a coil's speck), the crest (a flat top in the light), the hair faded toward the skin (`fade1` most of the way to the hair, `fade2` mostly
 * skin), the scalp (the skin's own tone in shadow: the ground between cornrows), the parting (the hair's deep step: a
 * shadow between braids), a fade (the skin graded up to the stubble: Scalp.grade), or a swatch. */
export type Tone = 'hair' | 'lit' | 'crest' | 'fade1' | 'fade2' | 'scalp' | 'parting' | 'fade' | string;
/** A shell; its `sheen`: `count` streaks round the comb in the lit tone (the first at `at` round it), between heights `from` and `to` (each streak's
 * ends jittered by `ragged`), each a spindle up to `width` of its share either side: the glossy band along the strands,
 * broken into strands' shines. */
export interface Scalp { from: Line; to?: Line; lift: number; crown?: number; edge?: number; ridges?: [number, number]; comb?: V3 | 'back'; tone?: Tone; sheen?: { count: number; from: number; to: number; width?: number; ragged?: number; at?: number }; /** A fade's grade up the band (0 its foot, 1 its top): from each height up, a tone (the skin below the first). */ grade?: [number, Tone][]; /** Only this far round either side of the front (a line-up at the temples). */ span?: number }
/** Rows from the hairline round `at` (the front by default), `span` either side of it, to one point (a direction from
 * the skull's centre, in head units) or each straight back to the nape. */
export interface Rows { count: number; at?: number; span: number; from: Line; to: V3 | 'nape'; nape?: Line; lift: number; rope: Rope; apart?: boolean; matte?: boolean; tone?: Tone }
/** A ponytail tied at a direction from the skull's centre (head units); its ropes rise `rise` of the head's height and
 * fall `length` of it below the shoulders, spread across `spread` of the half-width at the tie and at the ends, clear of
 * the dressed trunk. */
export interface Tail { at: V3; count: number; rope: Rope; rise: number; length: number; spread: [number, number]; tie?: Tie; cuffs?: string; matte?: boolean }
/** A tie: `true` the wearer's (HairInput.tie: the outfit's own metal, else a band of the hair's own), or a swatch. */
export type Tie = boolean | string;
/** One of the three generators' pieces. */
type OwnPiece = { scalp: Scalp } | { rows: Rows } | { tail: Tail };
/** A piece of a style: one of the three generators', or a registered piece (H3, registerHairPiece) keyed by its kind's
 * name, its value what that kind's builder takes. */
export type Piece = OwnPiece | { [kind: string]: unknown };
/** A style's finish, whatever colour it is worn in (a hair swatch gives only its hue ramp): tight coils (a fade's
 * stubble) or braids here, and any finish a fork registers (H4, registerFinish) by name. */
export type Finish = string;
/** Each finish's light: how far the key reaches down its form (paint.ts thresholds: the light on its crests, a shadow
 * side), and whether it is matte (no glint, and its lit tone a step up in the shadow too, so a plait's beads, a loc's
 * edge, a coil's specks read on the dark side as well). */
const FINISH: Record<'coil' | 'braid', { tones: [number, number, number]; matte: boolean }> = {
  // Tight coils: mostly mid, the light on the crests.
  coil: { tones: [0.8, 0.3, -0.4], matte: true },
  // Braids: the light a rare crest and a deep shadow side, so the beads and the ropes carry the form.
  braid: { tones: [0.9, 0.2, -0.8], matte: true },
};
/** A finish's light (FINISH). */
type Light = { tones: [number, number, number]; matte: boolean };
/** The finishes a fork registers (registerFinish), by name. Empty in base. */
const FINISHES = new Map<string, Light>();
/** Registers a hair finish (H4) under `name`, which a style's `finish` then names: how far the key reaches down its form
 * (`tones`, as FINISH's) and whether it is matte. A matte finish never takes the sheen band (finish()). Throws on a name
 * base or an earlier registration has taken. */
export function registerFinish(name: string, light: Light): void {
  if (name in FINISH || FINISHES.has(name)) throw new Error(`hair finish ${name} is registered already`);
  FINISHES.set(name, light);
}
/** `finish`: its texture's light; the colour it is worn in gives only the hue. */
export interface HairStyle { about: string; pieces: Piece[]; finish: Finish }
/** The hair styles a character names (library/hair.json): the generators' pieces and the finish they are painted with. */
export const HAIR_STYLES = hairLibrary as unknown as Record<string, HairStyle>;
/** The turn that takes +y onto `dir`. */
export const alignY = (dir: V3) => { const d = normalize(dir), axis = cross([0, 1, 0], d); return Math.hypot(...axis) < 1e-6 ? axisAngle([1, 0, 0], d[1] > 0 ? 0 : Math.PI) : axisAngle(axis, Math.acos(clamp(d[1], -1, 1))); };
/** A point on the head's own form (head.ts headAt) at a skull angle and height, `lift` of the skull's half-width out. */
export function onHead(f: HeadForm, k: Skull, a: number, y: number, lift = 0): V3 {
  const t = (clamp(y, -1, 1) + 1) / 2, v = Math.PI / 2 - a;
  return add(headAt(f, t, v), scale(headNormal(f, t, v), lift * k.r[0]));
}
/** A shell between two lines round the head (`to` the crown when left out), `lift` of the skull's half-width off its form
 * `f` along its normal, with a hole `cut` in it (a gap a fork's headwear may leave). `keep` picks its cells by row (a fade's tiers). */
export function shell(k: Skull, o: Scalp, f: HeadForm, keep?: (i: number) => boolean): { mesh: Mesh; lit?: Mesh } {
  const cols = 56, rows = 18, lift = (t: number, a: number, y: number) => {
    const comb = o.ridges ? 1 + o.ridges[1] * Math.cos(o.ridges[0] * combPhase(k, o.comb ?? [0, 1, 0], a, y)) * smooth(t * 3) : 1;
    // Thinner at the hairline (`edge`, of the lift), fuller toward the crown.
    return (o.lift * lerp(o.edge ?? 1, 1, smooth(t * 4)) + (o.crown ?? 0) * Math.max(0, y)) * comb;
  };
  const point = (i: number, j: number) => {
    const a = -Math.PI + 2 * Math.PI * j / cols, y0 = along(o.from, a), y1 = o.to ? along(o.to, a) : 1, t = i / rows, y = lerp(y0, y1, t);
    return onHead(f, k, a, y, lift(t, a, y));
  };
  const mid = (i: number, j: number) => { const a = -Math.PI + 2 * Math.PI * (j + 0.5) / cols, y0 = along(o.from, a); return { a, y0, y: lerp(y0, o.to ? along(o.to, a) : 1, (i + 0.5) / rows) }; };
  const cut = (i: number, j: number) => {
    if (keep && !keep(i)) return true;
    if (o.span !== undefined && Math.abs(mid(i, j).a) > o.span) return true;
    return false;
  };
  const streak = (i: number, j: number) => {
    if (!o.sheen) return false;
    const { a, y } = mid(i, j), q = o.sheen.count * (combPhase(k, o.comb ?? [0, 1, 0], a, y) - (o.sheen.at ?? 0)) / (2 * Math.PI), n = Math.round(q), r = (o.sheen.ragged ?? 0.12) * (hash(n * 13 + 5) - 0.5) * 2;
    const lo = o.sheen.from + r, hi = o.sheen.to + r * 0.5;
    return Math.abs(q - n) < (o.sheen.width ?? 0.22) * spindle((y - lo) / (hi - lo));
  };
  const mesh = grid(rows, cols, point, true, () => k.c, (i, j) => cut(i, j) || streak(i, j));
  return { mesh, lit: o.sheen ? grid(rows, cols, point, true, () => k.c, (i, j) => cut(i, j) || !streak(i, j)) : undefined };
}
/** The angle round the way the hair is combed: round the axis it is combed toward, or across the head (combed back). */
export function combPhase(k: Skull, comb: V3 | 'back', a: number, y: number) {
  const p = sub(onSkull(k, a, y), k.c), d: V3 = [p[0] / k.r[0], p[1] / k.r[1], p[2] / k.r[2]];
  if (comb === 'back') return Math.asin(clamp(d[0] / (Math.hypot(...d) || 1), -1, 1));
  const ax = normalize(comb), u = normalize(cross(ax, Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), w = cross(ax, u);
  return Math.atan2(dot(d, w), dot(d, u));
}
export interface HairInput {
  m: Measure; s: Skeleton; hair: string; skin: string; swatch: (name: string) => Material;
  /** The texels a metre it is drawn at (a tie, a cuff land on whole texels; the brand kit's twice when left out). */
  ppm?: number;
  /** The wearer's tie (a swatch): the outfit's metal, or one it names. */
  tie?: string;
  /** The dressed trunk (its tops and the body's torso, rest figure space): what a tail falls clear of. */
  trunk?: Part[];
  /** Under a cap or other headwear (outfit/garments.ts dress): the hair is drawn for it, as a registered piece (H3) may need to know. */
  capped?: boolean;
}
/** The texels a metre at twice the brand kit's density (paint.ts densityOf): the size the figures are judged at. */
export const PPM = 73.8;
/** A feature `want` metres across, held to whole texels at `ppm` (at least `least` of them). */
export const texels = (want: number, ppm: number, least = 1) => Math.max(least, Math.round(want * ppm)) / ppm;
export interface HairLook { parts: Part[]; decals: Decal[]; materials: Record<string, Material> }
/** A piece's material in a tone: the swatch's colour alone (its hue ramp; its own light and gloss are the brows' and a
 * lock's), lit as the style's finish (FINISH), never with noise (the texture is the strands', beads' and coils' own
 * shapes); the fades, a run from the skin's own tones to the hair's; the scalp, the skin's own mid down its dark steps
 * (the ground between cornrows, lighter than the rows). */
function finish(i: HairInput, f: Finish, tone: Tone, made: Record<string, Material>, matte = false): string {
  if (!['hair', 'lit', 'crest', 'fade1', 'fade2', 'scalp', 'parting'].includes(tone)) return tone;
  const light = (FINISH as Record<string, Light | undefined>)[f] ?? FINISHES.get(f); if (!light) throw new Error(`no finish ${f}`);
  const dull = matte || light.matte, name = `${i.hair}@${tone}:${f}${dull ? '~matte' : ''}`;
  if (made[name]) return name;
  const sw = i.swatch(i.hair), skin = i.swatch(i.skin);
  const p = sw.paint ?? tonesOf(sw).map(hexOf), hair: Material = { ramp: sw.ramp, base: sw.base, paint: p, tones: light.tones, ...(dull ? {} : { sheen: true }) };
  if (tone === 'hair') { made[name] = hair; return name; }
  // The lit tone: the hair's light and mid each a step up (the light raised along its DUEL row, so the sheen keeps its
  // hue), its shadow and deep the hair's own, so a streak shows where the light is and the shadow stays quiet; matte,
  // its shadow a step up too (the next lighter of the hair's own: black's two darks are one), so a plait, a loc's edge,
  // a coil's specks read down the dark side.
  const up = (q: number) => p.slice(0, q).reverse().find(c => c !== p[q]) ?? raise(p[q]);
  // The designed tones (a lit streak, a crest, a parting) are the style's own light: no sheen band laid over them.
  if (tone === 'lit') { made[name] = { ...hair, sheen: undefined, paint: dull ? [raise(p[0]), up(1), up(2), p[3]] : [raise(p[0]), p[0], p[2], p[3]] }; return name; }
  // The crest: the lit tone with the light reaching further down the form, so a plane facing up (a high-top's flat top)
  // takes the light whole, one crisp tone against the coils of its sides.
  if (tone === 'crest') { made[name] = { ...hair, sheen: undefined, tones: [0.45, 0.05, -0.5], paint: [raise(p[0]), p[0], p[1], p[2]] }; return name; }
  if (tone === 'parting') { made[name] = { ...hair, sheen: undefined, paint: [p[3], p[3], p[3], p[3]] }; return name; }
  if (tone === 'scalp') { const t = tonesOf(skin); made[name] = { ...skin, gloss: undefined, paint: [t[1], t[2], t[3], t[3]].map(hexOf) }; return name; }
  // A fade's tier names its two ends, the hair's tones and the skin's a step darker, for the painter to mix (paint.ts
  // mixTones: tone by tone, in OKLab, in the skin's hue), so the run is never a grey or a mauve between them and stays in
  // order, light to deep, whatever the hair's colour against the skin's: `fade1` (nearer the hair) 0.3 of the way to the
  // skin, `fade2` (nearer the skin) 0.6.
  const sr = tonesOf(skin).map(hexOf);
  made[name] = { ...skin, gloss: undefined, paint: undefined, mix: { from: tonesOf(hair).map(hexOf), to: [sr[1], sr[2], sr[3], sr[3]], at: tone === 'fade1' ? 0.3 : 0.6 } };
  return name;
}
/** A DUEL colour a step up its ramp. */
function raise(hex: string) {
  const c = parseInt(hex.slice(1), 16);
  for (const row of RAMPS) { const i = row.indexOf(c); if (i >= 0) return hexOf(row[Math.min(7, i + 1)]); }
  return hex;
}
/**
 * What a registered hair piece (H3, registerHairPiece) is given: the style's input, its skull, head form, head pivot,
 * half-width and density, the parts and marks the style is making (a piece pushes onto them), the helpers the three
 * generators draw with (`rigid` a piece rigid on the head, `hung` one skinned to the hair's joints, `tone` a tone's
 * material in the style's finish, `tieOf` a tie's swatch), and `seam`, the one counter of own surfaces every piece of a
 * style shares, so seams number as they always have whatever the mix of pieces.
 */
export interface HairCtx {
  i: HairInput; k: Skull; form: HeadForm; head: V3; hw: number; ppm: number;
  parts: Part[]; decals: Decal[];
  rigid(mesh: Mesh, t: Tone, own?: number, lit?: Mesh, matte?: boolean): void;
  hung(mesh: Mesh, ts: number[], to: Tone, swing: (t: number) => [number, number][], own: number, lit?: Mesh, matte?: boolean): void;
  tone(t: Tone, matte?: boolean): string;
  tieOf(t: Tie | undefined): string | null;
  /** The next own surface: the counter every piece of a style shares. */
  seam(): number;
}
/** A hair piece a fork registers (H3): how one entry of a style's `pieces` is built. */
export interface HairPiece<T = any> {
  build(c: HairCtx, piece: T): void;
  /** Its parts take the CROWN tag, like the scalp's and the rows': what is worn up on the head lies on them. */
  crown?: boolean;
}
/** The hair pieces a fork registers (registerHairPiece), by kind. Empty in base. */
const PIECES = new Map<string, HairPiece>();
/** Registers a hair piece under `kind`, the key a style's piece carries ({ bun: {…} }). Throws on a name taken, the
 * generators' (scalp, rows, tail) included. */
export function registerHairPiece(kind: string, p: HairPiece): void {
  if (['scalp', 'rows', 'tail'].includes(kind) || PIECES.has(kind)) throw new Error(`hair piece ${kind} is registered already`);
  PIECES.set(kind, p);
}
/** A style's parts on the head and its swinging joints, fitted to the skeleton's head and the body under it. */
export function hairParts(i: HairInput, style: HairStyle): HairLook {
  const { s, m } = i, k = skull(s), form = headForm(m, s), head = s.rest[J.head], hw = k.r[0], parts: Part[] = [], decals: Decal[] = [], made: Record<string, Material> = {};
  const ppm = i.ppm ?? PPM;
  /** A tie's swatch: the style's own, or the wearer's (true), else a band in the hair's own lit tone. */
  /** A tone's material in the style's finish. */
  const tone = (t: Tone, matte?: boolean) => finish(i, style.finish, t, made, matte);
  const tieOf = (t: Tie | undefined) => (!t ? null : typeof t === 'string' ? t : i.tie ?? tone('lit'));
  let seam = HAIR_SEAM + 100;
  /** A rigid piece on the head. */
  const rigid = (mesh: Mesh, t: Tone, own = HAIR_SEAM, lit?: Mesh, matte?: boolean) => {
    parts.push({ bone: J.head, mesh, material: tone(t, matte), group: 1, seam: own });
    if (lit) parts.push({ bone: J.head, mesh: lit, material: tone('lit', matte), group: 1, seam: own });
  };
  /** A skinned piece: its points in head space, each weighted from the head toward `joint` by `w` of its way along. */
  const hung = (mesh: Mesh, ts: number[], to: Tone, swing: (t: number) => [number, number][], own: number, lit?: Mesh, matte?: boolean) => {
    for (const [m, t] of [[mesh, to], ...(lit ? [[lit, 'lit']] : [])] as [Mesh, Tone][]) {
      const placed = { ...m, positions: m.positions.map((v, n) => v + head[n % 3]) };
      parts.push({ mesh: placed, material: tone(t, matte), group: 1, seam: own, skin: ts.map(swing) });
    }
  };
  /** What a registered piece (a fork's, registerHairPiece) is given: the same helpers and the one seam counter. */
  const ctx: HairCtx = { i, k, form, head, hw, ppm, parts, decals, rigid, hung, tone, tieOf, seam: () => seam++ };
  for (const piece of style.pieces) {
    const first = parts.length;
    // The generators' own pieces are told apart by their key; any other is a registered piece, handled last.
    const own = piece as OwnPiece;
    if ('scalp' in own) {
      const o = own.scalp;
      // A fade: the head's own surface graded up the band in tiers, the skin at its foot (its material, so it shades on
      // unbroken from the neck and the ear), then the hair's tones mixed toward the skin's, then the stubble (the hair's,
      // matte), each tier one solid tone, so it grades with no speckle and no line where it meets the top.
      if (o.tone === 'fade') {
        const grade = o.grade ?? [], tier = (row: number) => grade.reduce((n, [at], q) => ((row + 0.5) / 18 >= at ? q : n), -1);
        for (let n = -1; n < grade.length; n++) {
          const { mesh } = shell(k, o, form, row => tier(row) === n);
          if (mesh.indices.length) parts.push({ bone: J.head, mesh, material: n < 0 ? i.skin : tone(grade[n][1], true), group: 1, seam: FACE_SEAM });
        }
      } else { const sh = shell(k, o, form); rigid(sh.mesh, o.tone ?? 'hair', HAIR_SEAM, sh.lit); }
    } else if ('rows' in own) {
      // Rows from the hairline, gathered to one point, or each straight back over the top to the nape, keeping its
      // place across the head (in the skull's units) so the rows run parallel and the scalp shows evenly between them.
      const o = own.rows;
      for (let r = 0; r < o.count; r++) {
        const a = (o.at ?? 0) + (o.count === 1 ? 0 : -o.span + 2 * o.span * r / (o.count - 1)), start = sub(onHead(form, k, a, along(o.from, a)), k.c);
        const path: V3[] = [];
        if (o.to === 'nape') {
          const end = sub(onHead(form, k, Math.PI - a, along(o.nape ?? [[0, -0.5]], Math.PI - a)), k.c);
          const u = (d: V3) => normalize([d[0] / k.r[0], d[1] / k.r[1], d[2] / k.r[2]]), us = u(start), ue = u(end);
          const f0 = Math.atan2(us[1], us[2]), f1 = Math.atan2(ue[1], ue[2]) + (Math.atan2(ue[1], ue[2]) < f0 ? 2 * Math.PI : 0);
          for (let q = 0; q <= 16; q++) {
            const t = q / 16, x = lerp(us[0], ue[0], t), f = lerp(f0, f1, t), c = Math.sqrt(1 - x * x);
            path.push(toHead(form, k, [x * k.r[0], c * Math.sin(f) * k.r[1], c * Math.cos(f) * k.r[2]], o.lift));
          }
        } else {
          const to = scale(normalize(o.to), Math.hypot(...start));
          for (let q = 0; q <= 8; q++) path.push(toHead(form, k, add(scale(normalize(start), 1 - q / 8), scale(normalize(to), q / 8)), o.lift));
        }
        // A slanted plait turns against the next row's, half a bead on, so rows side by side read as a herringbone.
        const slant = o.rope.slant ? { phase: (r % 2) * 0.5, slant: (r % 2 ? 1 : -1) * o.rope.slant } : {};
        const { mesh, lit } = sweep(path, { tip: 'blunt', ...o.rope, ...slant }, hw, p => sub(p, k.c));
        rigid(mesh, o.tone ?? 'hair', o.apart === false ? HAIR_SEAM : seam++, lit, o.matte);
      }
    } else if ('tail' in own) tail(own.tail);
    else {
      const name = Object.keys(piece)[0], p = PIECES.get(name);
      if (!p) throw new Error(`no hair piece ${name}`);
      p.build(ctx, (piece as Record<string, unknown>)[name]);
    }
    // The hair's top over the crown (its shells and rows; never a tail, a fade): what is worn up lies on it, not on
    // whatever stands furthest out.
    if ('rows' in own || ('scalp' in own && own.scalp.tone !== 'fade') || PIECES.get(Object.keys(piece)[0])?.crown) for (let n = first; n < parts.length; n++) parts[n].tag = CROWN;
  }
  /**
   * A high ponytail: tied on the crown, its ropes gathered in a ring at the tie, rising out of it, arcing back over the
   * top and falling onto the back of the head still gathered (narrower than the head, so the round skull and the rows
   * climbing it to the tie show either side), then down the back, fanning a little, clear of the dressed trunk by a
   * rope and a texel. Every other rope is thinner and in the hair's dark, sunk between its neighbours on either face: the
   * partings between the ropes, seen from behind and from the side alike. Their plaits run on a slant, turned against their neighbours' and half a bead apart, so the tail reads as ropes
   * running down in a herringbone, never as rungs across it.
   */
  function tail(o: Tail) {
    const base = toHead(form, k, o.at, 0.05), g = s.genes, kk = m.k, up = normalize(sub(base, k.c)), side = normalize(cross(up, [0, 0, 1])), fore = cross(side, up);
    const texel = 1 / ppm, ar = o.rope.r * hw, shoulder = s.shoulderY - head[1], end = shoulder - o.length * g.head;
    const rise = o.rise * g.head, tie = add(base, scale(up, rise * 0.45)), bundle = o.spread[0] * hw, x1 = o.spread[1] * hw, clear = ar * 1.2 + texel;
    // The back of the head at a height (head space), and the dressed trunk's furthest back down the tail's length.
    const headBack = (y: number) => form.back(clamp(y / form.h, 0.02, 0.98));
    const trunkBack = (y: number) => { const r = reach(i.trunk ?? [], s.rest, [0, y + head[1], 0], [0, 0, -1]); return r > 0 ? -r - head[2] : Infinity; };
    const hang = Math.min(headBack(k.c[1] - 0.6 * k.r[1]), ...[0, 0.2, 0.4, 0.6, 0.8, 1].map(q => trunkBack(lerp(shoulder + 0.03 * kk, end, q)))) - clear;
    // Its fall stands off the back of the head as it comes down from the crown (the nape shows under it in profile, and
    // in three-quarter the tail shows past the head), and hangs from the shoulder blades.
    const nape = k.c[1] - 0.55 * k.r[1], off = 0.25, napeZ = Math.min(headBack(nape) - off * k.r[2], trunkBack(nape)) - clear;
    for (let r = 0; r < o.count; r++) {
      const u = o.count === 1 ? 0 : r / (o.count - 1) * 2 - 1, ring = 2 * Math.PI * (r + 0.5) / o.count, jit = hash(r * 7 + 3) - 0.5;
      // A layer out from the back (−z) for the ropes on top, so those under lie nearer the body, between them.
      const top = r % 2 === 0, layer = 0, x = (w: number) => u * lerp(bundle, x1, w);
      const at = (p: V3, w: number) => add(p, add(scale(side, Math.cos(ring) * bundle * w), scale(fore, Math.sin(ring) * bundle * w)));
      const path: V3[] = [
        at(base, 0.8), at(tie, 1),
        // Up out of the tie, over the top still gathered, and down onto the back of the head.
        add(at(tie, 1.05), add(scale(up, rise * 0.45), [0, 0, -0.25 * k.r[2]])),
        add(at(tie, 1.15), [0, rise * 0.3, -0.62 * k.r[2] - layer]),
        [x(0.15), k.c[1] + 0.5 * k.r[1], headBack(k.c[1] + 0.5 * k.r[1]) - off * 0.6 * k.r[2] - clear - layer],
        [x(0.4), nape, napeZ - layer],
        [x(0.85), shoulder, Math.min(napeZ, hang) - layer],
        [x(1), end + jit * 0.1 * g.head, hang - layer - 0.01 * kk],
      ];
      // The ropes on top plait on a slant, turned against the next one's and half a bead on; those under are its partings.
      const n2 = r >> 1, rope: Rope = top ? { ...o.rope, root: 0.02, phase: (n2 % 2) * 0.5 + hash(r * 5 + 1) * 0.2, slant: (n2 % 2 ? 1 : -1) * (o.rope.slant ?? 0) } : { ...o.rope, r: o.rope.r * 0.7, root: 0.02, plait: false };
      const { mesh, lit, t } = sweep(path, rope, hw, (p, tt) => (tt < 0.2 ? fore : [0, 0, -1]));
      // The top rides the head, the length swings from the back pivot and settles toward the neck as it falls (never the
      // chest: a heavy tail skinned to it would ride the torso's turn and lean).
      const swing = 0.5, swingOf = (tt: number): [number, number][] => { const w = smooth((tt - 0.08) / 0.4), lay = smooth((tt - 0.45) / 0.55) * (1 - swing); return [[J.head, 1 - w], [J['hair.back'], w * (1 - lay)], [J.neck, w * lay]]; };
      hung(mesh, t, top ? 'hair' : 'parting', swingOf, seam++, lit, o.matte);
      // A cuff on every other braid near its end, staggered, only where it can be two texels tall (from three times the
      // brand kit's density): below that a cuff is a speck.
      if (o.cuffs && top && ppm >= PPM * 1.5) {
        const P = spline(path, 20), q = 14 + Math.round(hash(r * 11 + 1) * 4), c = P[q], dir = normalize(sub(P[q + 1], P[q - 1]));
        const cuff = superquadric({ at: c, r: [ar * 1.15, texels(0.03 * g.head, ppm, 2) / 2, ar * 1.15], e: [0.3, 1], seg: 8, rings: 4, turn: alignY(dir) });
        hung(cuff, cuff.positions.filter((_, n) => n % 3 === 0).map(() => 0.85), o.cuffs, swingOf, seam++);
      }
    }
    // The tie: a band round the gathered ropes where they rise from the crown, whole texels tall (two at the judged
    // size), so it reads as the pony's root.
    const band = tieOf(o.tie);
    if (band) parts.push({ bone: J.head, mesh: superquadric({ at: add(base, scale(up, rise * 0.3)), r: [bundle + ar * 1.1, texels(0.05 * g.head, ppm) / 2, bundle + ar * 1.1], e: [0.25, 1], seg: 14, rings: 4, turn: alignY(up) }), material: band, group: 1, seam: seam++ });
  }
  return { parts, decals, materials: made };
}
