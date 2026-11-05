import { J, type Side, type Skeleton } from './rig';
import { apply, axisAngle, compose, cross, dot, lerp, normalize, smooth, sub, type V3 } from './math';
import { GROUP, limb, placed, superquadric, weights, type Decal, type Limb, type Material, type Mesh, type Part, type Superquadric } from './parts';
import type { HeadShape, Measure } from './genes';
import { FACE_SEAM, tonesOf } from './paint';
import swatchLibrary from './library/swatches.json';
import hairLibrary from './library/hair.json';
import type { Anchor } from './motion';
import { hairParts, sweep, texels, PPM, type HairStyle } from './hair';
/**
 * The body and what the base pair wears. A character is sliders (genes.ts) plus a list of garments, each fitted to the
 * body the sliders make: a top painted on the torso and as much of the arms as its sleeves cover, shorts painted on the
 * hips and thighs, a hair style from the generator's pieces (hair.ts), and the eyes, whose lids, brows and mouth are
 * marks (decals that an expression changes) unless the painter draws the face (paint.ts). The body is profiled limbs
 * (parts.ts), each one surface, with a head (head form, ears, nose), hands and bare feet. Colours are named DUEL
 * swatches (library/swatches.json). A fork adds its wardrobe beside this, in its own feature folder.
 */
export { GROUP };
const armGroup = (side: Side) => (side === 'L' ? GROUP.armL : GROUP.armR), legGroup = (side: Side) => (side === 'L' ? GROUP.legL : GROUP.legR);
const sides = [['L', 1], ['R', -1]] as const;
/** A rounded box: the kit's one primitive. */
export const box = (bone: number, material: string, group: number, o: Superquadric, extra: Partial<Part> = {}): Part => ({ bone, material, group, mesh: superquadric({ e: [0.5, 0.55], seg: 10, rings: 6, ...o }), ...extra });

// ─── Swatches: named DUEL ramp rows and steps (src/render/duel-ramps.ts), from the library (library/swatches.json) ───
/** The shared palette library; a character file adds its own swatches (cast.ts). Every colour is DUEL-checked (tests). */
export const SWATCHES = swatchLibrary as unknown as Record<string, Material>;

// ─── Garments ───
export type Garment =
  /** A top painted on the torso, and as much of the arms as its sleeves cover (the base pair's: none). */
  | { top: string; sleeves?: 'none' | 'short' | 'long' }
  /** Shorts painted on the body (the hips and thighs), with no cloth of their own: a base figure's modest block. */
  | { shorts: string }
  /** `tie`: the band a pony or a bun is tied with (a swatch); left out, a band of the hair's own. */
  | { hair: string; style: string | HairStyle; tie?: string }
  /** The eyes, the marks face's lids and brows, and the drawn face's (paint.ts) whites and lips. */
  | { eyes: string; lids?: string; brows?: string; white?: string; lips?: string };
/** Hair styles: the generators' pieces (hair.ts) and the finish they are painted with (library/hair.json). */
export const HAIR_STYLES = hairLibrary as unknown as Record<string, HairStyle>;
const named = <T>(library: Record<string, T>, kind: string, style: string | T): T => {
  if (typeof style !== 'string') return style;
  const found = library[style]; if (!found) throw new Error(`no ${kind} ${style}`); return found;
};
/** Materials of the body's regions; garments repaint them. */
interface Regions { skin: string; chest: string; waist: string; pelvis: string; shoulder: string; upper: string; fore: string; hand: string; thigh: string; knee: string; shin: string; neck: string }
/** A dressed body: its parts and marks, any materials the outfit makes for itself, its face, and the openings a hand can
 * reach (motion.ts Anchor). Base's garments publish none, so a hand finds the body's own hip (motion.ts openings); a
 * fork's wardrobe publishes its pockets and hems here. */
export interface Look { parts: Part[]; decals: Decal[]; materials?: Record<string, Material>; face?: FaceLook; anchors?: Anchor[] }
/** What the painter's drawn face takes from the outfit (paint.ts): the head's structure, and its colours as swatch names. */
export interface FaceLook { shape: HeadShape; eyes?: string; white?: string; brows?: string; lips?: string }
/**
 * Dresses a body: the garments in order repaint regions and add parts, then the body is built under them. Returns
 * the parts and decals, every one sized from the measure; `ppm` the texels a metre it is drawn at (the cell's), so the
 * small features (a tie, an ear's rim, a cap's seam) land on whole texels at any density.
 */
export function dress(m: Measure, s: Skeleton, skin: string, garments: Garment[], swatches: Record<string, Material> = SWATCHES, ppm?: number): Look {
  const swatch = (name: string): Material => { const found = swatches[name]; if (!found) throw new Error(`no swatch ${name}`); return found; };
  const r: Regions = { skin, chest: skin, waist: skin, pelvis: skin, shoulder: skin, upper: skin, fore: skin, hand: skin, thigh: skin, knee: skin, shin: skin, neck: skin };
  const parts: Part[] = [], decals: Decal[] = [], made: Record<string, Material> = {};
  let thighs = true, faceLook: FaceLook = { shape: m.face };
  for (const item of garments) {
    if ('top' in item) {
      r.chest = r.waist = item.top;
      // A sleeveless top leaves the shoulder's round bare: the arm one surface of skin from the shoulder to the hand.
      if (item.sleeves !== 'none') r.shoulder = item.top;
      if (item.sleeves !== 'none') r.upper = item.top;
      if (item.sleeves === 'long') r.fore = item.top;
    } else if ('shorts' in item) { r.pelvis = r.thigh = item.shorts; }
    // The hair: the generators' pieces (hair.ts), one surface, so the painter draws no line between them.
    else if ('hair' in item) {
      const style = typeof item.style === 'string' ? named(HAIR_STYLES, 'hair style', item.style) : item.style;
      // The tie in the wearer's own palette: the one it names, else a band of the hair's own. The trunk the hair falls
      // clear of: the tops worn by now over the body's own torso.
      const tie = item.tie;
      const trunk = [...parts, ...body(m, s, r, thighs)].filter(p => p.group === GROUP.torso);
      const hair = hairParts({ m, s, hair: item.hair, skin, swatch, ppm, tie, trunk }, style);
      parts.push(...hair.parts); decals.push(...hair.decals); Object.assign(made, hair.materials);
    } else if ('eyes' in item) {
      decals.push(...face(s, item.eyes, item.lids ?? 'lid', item.brows ?? 'brow'));
      faceLook = { shape: m.face, eyes: item.eyes, white: item.white, brows: item.brows, lips: item.lips };
    }
  }
  Object.assign(made, earSkins(skin, swatch(skin)));
  return { parts: [...body(m, s, r, thighs, ppm), ...parts], decals, materials: made, face: faceLook, anchors: [] };
}
/** The body's surfaces: the torso, each arm (shoulder to hand) and each leg (thigh to foot) one surface apiece, so the
 * painter draws no crevice or line at a waist, an elbow or a knee (paint.ts); garments keep their own edges. */
const SURFACE: Record<number, number> = { [GROUP.torso]: 3000, [GROUP.armL]: 3001, [GROUP.armR]: 3002, [GROUP.legL]: 3003, [GROUP.legR]: 3004 };
/** The thumbs are surfaces of their own, so the painter's crevice tone draws each against its palm. */
const THUMB = { L: 3005, R: 3006 } as const;
function surfaces(parts: Part[]): Part[] {
  return parts.map(p => (p.seam === undefined && SURFACE[p.group] !== undefined ? { ...p, seam: SURFACE[p.group] } : p));
}
/** The trapezius's slope (rad): the body's shoulder line runs up it to the neck. */
const TRAPEZIUS = 0.6;
/** One stretch of a skinned limb in rest figure space: the profile cut to [hi, lo], painted `material`. */
function stretch(material: string, group: number, o: Limb, hi: number, lo: number, skin: (x: number, y: number, z: number) => [number, number][]): Part {
  const mesh = limb({ ...o, span: [hi, lo] });
  return { mesh, material, group, skin: weights(mesh, skin) };
}
/** Two bones' weights across a joint at `y`, blended over `soft` either side (a smooth union for the skinning). */
const across = (upper: number, lower: number, y: number, soft: number) => (py: number): [number, number][] => {
  const w = smooth((py - (y - soft)) / (2 * soft));
  return [[upper, w], [lower, 1 - w]];
};
/**
 * The body under the clothes, every size from the measure. The torso, each arm (deltoid to wrist) and each leg (hip to
 * ankle) is one profiled limb (parts.ts), skinned across its joints, so it reads as anatomy, not stacked boxes: shoulders
 * that cap the arm, a waist and hips, arms that taper to a wrist, a knee, a calf and an ankle. Each region a garment may
 * repaint (chest, waist, pelvis; shoulder, upper arm, forearm; thigh, knee, shin) is its own stretch of the one profile,
 * cut ring to ring, so a sleeve's end is a material's edge on an unbroken form.
 */
function body(m: Measure, s: Skeleton, r: Regions, thighs: boolean, ppm?: number): Part[] {
  const g = s.genes, k = m.k, t = m.thick, fw = m.foot, foot = g.foot, hand = m.hand;
  const f = m.sliders.frame, mu = lerp(0.92, 1.1, m.sliders.muscle), D = k * t * m.depth;
  const a = k * t * m.arm * mu * lerp(1.04, 0.94, f), l = k * t * m.leg * lerp(0.96, 1.04, f), sh = g.shoulders, C = m.chest;
  const hipY = s.hipY, waistY = hipY + 0.155 * k, chestY = s.chestY, shoulderY = s.shoulderY, pelvisY = s.rest[J.pelvis][1];
  const neck = lerp(0.85, 1.15, m.sliders.neck) * lerp(1.05, 0.95, f);
  // ─── Torso: seat, hips, waist, ribs, chest, the shoulders up the trapezius to the neck ───
  // The trapezius: from the shoulder's top ring a straight slope (TRAPEZIUS) in to the neck's root, standing either side
  // of it, so the line from the neck to the shoulder point falls as a muscle does rather than squaring off.
  const trap = sh * 0.42, trapY = shoulderY - 0.016 * k + Math.tan(TRAPEZIUS) * (sh * 0.84 - trap);
  const torso: Limb = { e: 0.82, seg: 20, caps: [0.02 * k, 0.03 * k], round: [0.3, 1], rings: [
    { y: trapY, rx: trap, rz: 0.058 * D, dz: -0.008 * k },
    { y: lerp(trapY, shoulderY - 0.016 * k, 0.55), rx: lerp(trap, sh * 0.84, 0.55) * 1.02, rz: 0.064 * D, dz: -0.006 * k },
    { y: shoulderY - 0.016 * k, rx: sh * 0.84, rz: 0.07 * D, dz: -0.004 * k },
    { y: shoulderY - 0.05 * k, rx: sh * 0.9 * C, rz: 0.088 * D, dz: 0.004 * k },
    { y: chestY + 0.03 * k, rx: sh * lerp(0.9, 0.84, f) * C, rz: 0.096 * D * lerp(1, 1.06, f), dz: 0.012 * k },
    { y: chestY - 0.07 * k, rx: sh * lerp(0.8, 0.74, f) * C, rz: 0.088 * D, dz: 0.008 * k },
    { y: waistY + 0.02 * k, rx: 0.11 * k * t * m.waist * lerp(1, 0.98, f), rz: 0.076 * D, dz: 0.002 * k },
    { y: hipY + 0.08 * k, rx: g.hips + 0.05 * k * t * lerp(0.95, 1.06, f), rz: 0.084 * D, dz: -0.002 * k },
    { y: hipY - 0.02 * k, rx: g.hips + 0.062 * k * t * lerp(0.95, 1.06, f), rz: 0.088 * D, dz: -0.006 * k },
    { y: hipY - 0.075 * k, rx: g.hips * 1.02, rz: 0.074 * D, dz: -0.006 * k },
  ] };
  // The trunk bends at the spine: the hips ride the pelvis, the ribs the chest, the waist between them.
  const trunk = (_x: number, y: number): [number, number][] => {
    const lo = smooth((y - (pelvisY + 0.02 * k)) / (s.rest[J.spine][1] - pelvisY)), hi = smooth((y - s.rest[J.spine][1]) / (chestY - s.rest[J.spine][1]));
    return [[J.pelvis, 1 - lo], [J.spine, lo * (1 - hi)], [J.chest, lo * hi]];
  };
  const belt = hipY + 0.09 * k, ribs = chestY - 0.07 * k;
  const parts: Part[] = [
    stretch(r.chest, GROUP.torso, torso, Infinity, ribs, trunk),
    stretch(r.waist, GROUP.torso, torso, ribs, belt, trunk),
    stretch(r.pelvis, GROUP.torso, torso, belt, -Infinity, trunk),
    // The neck, leaning forward to carry the head ahead of the shoulders: narrow under the jaw (which overhangs it a
    // texel), running up behind the ear, then flaring into the trapezius at its root, so it tapers from the head to the
    // collar rather than standing as a column the jaw's width. Its top is closed (seen from above and behind, past the
    // nape, it shows no hole).
    { bone: J.neck, material: r.neck, group: GROUP.head, mesh: limb({ seg: 12, caps: [0.02 * k, 0.02 * k], rings: [
      { y: g.neck + 0.04 * k, rx: 0.042 * k * neck, rz: 0.048 * k * neck, dz: 0.012 * k },
      { y: g.neck * 0.6, rx: 0.044 * k * neck, rz: 0.049 * k * neck, dz: 0.006 * k },
      { y: g.neck * 0.1, rx: 0.051 * k * neck, rz: 0.051 * k * neck, dz: -0.002 * k },
      { y: -0.04 * k, rx: 0.068 * k * neck, rz: 0.056 * k * neck, dz: -0.01 * k },
    ] }) },
    ...head(m, s, r.skin, ppm),
  ];
  for (const [side, x] of sides) {
    const ag = armGroup(side), lg = legGroup(side);
    // ─── Arm: the deltoid's cap, biceps, elbow, the forearm's swell, a wrist ───
    // Drawn for the sprite's size: each change of the form a texel's step at D2, and the two contours curving against
    // each other (the deltoid out, the biceps forward, the elbow's point back, the forearm's swell out on its outer side
    // while its inner line runs straight), so the light turns over it rather than running down a ribbon.
    const ay = s.rest[J[`upperArm.${side}`]][1], ax = x * sh, U = s.upperArm, F = s.foreArm, elbow = ay - U, wrist = ay - g.arms;
    const arm: Limb = { seg: 14, caps: [0.028 * k, 0.012 * k], rings: [
      { y: ay - 0.012 * k, rx: 0.044 * a, rz: 0.048 * a, dx: ax + x * 0.002 * k },
      { y: ay - 0.05 * k, rx: 0.045 * a, rz: 0.048 * a, dx: ax + x * 0.004 * k },
      // The deltoid's insertion: the cap breaks into the upper arm.
      { y: ay - 0.4 * U, rx: 0.036 * a, rz: 0.04 * a, dx: ax + x * 0.001 * k },
      // The biceps forward, the triceps behind it.
      { y: ay - 0.64 * U, rx: 0.037 * a, rz: 0.044 * a, dx: ax, dz: 0.005 * k },
      // The elbow, slim, its point behind.
      { y: elbow + 0.04 * U, rx: 0.029 * a, rz: 0.032 * a, dx: ax, dz: -0.003 * k },
      // The forearm's swell under the elbow, out on its outer side only.
      { y: elbow - 0.22 * F, rx: 0.038 * a, rz: 0.035 * a, dx: ax + x * 0.008 * k, dz: 0.002 * k },
      { y: elbow - 0.6 * F, rx: 0.028 * a, rz: 0.027 * a, dx: ax + x * 0.002 * k },
      // The wrist's notch, the hand flaring from it.
      { y: wrist + 0.08 * F, rx: 0.018 * a, rz: 0.024 * a, dx: ax },
      { y: wrist, rx: 0.017 * a, rz: 0.022 * a, dx: ax },
    ] };
    const bend = across(J[`upperArm.${side}`], J[`foreArm.${side}`], elbow, 0.05 * k);
    // The shoulder's top rides the chest a little, so a swinging arm rolls under its cap rather than lifting it.
    const shoulder = (_x: number, y: number): [number, number][] => { const c = 0.45 * smooth((y - (ay - 0.03 * k)) / (0.07 * k)); return [[J.chest, c], [J[`upperArm.${side}`], 1 - c]]; };
    const armSkin = (px: number, py: number) => (py > ay - 0.1 * k ? shoulder(px, py) : bend(py));
    parts.push(
      stretch(r.shoulder, ag, arm, Infinity, ay - 0.075 * k, armSkin),
      stretch(r.upper, ag, arm, ay - 0.075 * k, elbow, armSkin),
      stretch(r.fore, ag, arm, elbow, -Infinity, armSkin),
      ...hands(J[`hand.${side}`], r.hand, ag, x, k * hand, [0.017 * a, 0.022 * a]),
    );
    // ─── Leg: the hip, a thigh that narrows to the knee, the kneecap, a calf behind the shin, the ankle ───
    const hx = x * g.hips, T = s.thigh, S = s.shin, knee = hipY - T, ankle = g.ankle;
    const leg: Limb = { seg: 14, caps: [0.03 * k, 0.018 * k], rings: [
      { y: hipY + 0.05 * k, rx: 0.075 * l, rz: 0.08 * l, dx: hx + x * 0.008 * k, dz: -0.008 * k },
      { y: hipY - 0.05 * k, rx: 0.078 * l, rz: 0.082 * l, dx: hx + x * 0.006 * k, dz: -0.002 * k },
      { y: hipY - 0.4 * T, rx: 0.066 * l, rz: 0.07 * l, dx: hx + x * 0.002 * k, dz: 0.004 * k },
      // The knee a clear narrowing under the thigh, the calf swelling behind the shin a third of the way down (its outer
      // head a touch higher and wider), the ankle slim above the foot: a leg, not a column, at sprite size.
      { y: knee + 0.2 * T, rx: 0.05 * l, rz: 0.053 * l, dx: hx, dz: 0.003 * k },
      { y: knee, rx: 0.042 * l, rz: 0.046 * l, dx: hx, dz: 0.006 * k },
      { y: knee - 0.28 * S, rx: 0.052 * l, rz: 0.06 * l, dx: hx + x * 0.003 * k, dz: -0.012 * k },
      { y: knee - 0.65 * S, rx: 0.034 * l, rz: 0.036 * l, dx: hx, dz: -0.004 * k },
      { y: ankle + 0.035 * k, rx: 0.024 * l, rz: 0.028 * l, dx: hx },
      { y: ankle, rx: 0.027 * l, rz: 0.03 * l, dx: hx },
    ] };
    const kneeBend = across(J[`thigh.${side}`], J[`shin.${side}`], knee, 0.05 * k);
    // The top of the thigh rides the pelvis in part: the hip creases as the leg swings, it does not lift out.
    const hip = (y: number): [number, number][] => { const p = 0.55 * smooth((y - (hipY - 0.07 * k)) / (0.12 * k)); return [[J.pelvis, p], [J[`thigh.${side}`], 1 - p]]; };
    const legSkin = (_x: number, py: number) => (py > hipY - 0.1 * k ? hip(py) : kneeBend(py));
    const above = knee + 0.06 * k, below = knee - 0.06 * k;
    if (thighs) parts.push(stretch(r.thigh, lg, leg, Infinity, above, legSkin));
    parts.push(stretch(r.knee, lg, leg, thighs ? above : knee + 0.03 * k, below, legSkin), stretch(r.shin, lg, leg, below, -Infinity, legSkin));
    // ─── Foot: bare, from the heel's round over the instep to the toes ───
    parts.push(...bareFoot(J[`foot.${side}`], r.skin, lg, k, fw, foot, ankle));
  }
  return surfaces(parts);
}
/** A smooth curve through (t, value) keys (Catmull-Rom, t ascending), held flat past either end. */
function curve(keys: [number, number][]): (t: number) => number {
  return t => {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t1, v1] = keys[i], [t2, v2] = keys[i + 1], [t0, v0] = keys[Math.max(0, i - 1)], [t3, v3] = keys[Math.min(keys.length - 1, i + 2)];
    const u = Math.max(0, Math.min(1, (t - t1) / (t2 - t1))), dt = t2 - t1;
    const m1 = (v2 - v0) / Math.max(1e-6, t2 - t0) * dt, m2 = (v3 - v1) / Math.max(1e-6, t3 - t1) * dt;
    return (2 * u ** 3 - 3 * u ** 2 + 1) * v1 + (u ** 3 - 2 * u ** 2 + u) * m1 + (-2 * u ** 3 + 3 * u ** 2) * v2 + (u ** 3 - u ** 2) * m2;
  };
}
/**
 * A head's form: its half-width and its front and back at each height t (0 the chin's point … 1 the crown's), `h` tall;
 * each section a superellipse, its front half a little squarer than its back (a face's planes before a round skull),
 * rounding again over the cranium. One form for the head's skin and for whatever hugs it (a fade, a sleek shell: hair.ts).
 */
export interface HeadForm { h: number; width: (t: number) => number; front: (t: number) => number; back: (t: number) => number }
/** The front half's roundness at height t: under the eyes a rounded wedge, the cheeks falling back from the nose and the
 * mouth (so at three-quarters the nose breaks the far cheek's line); from the eyes up full, the brow running across to
 * the temples (so the far eye shows inside the contour); over the cranium round again. The back half is an ellipse. */
const faceRound = (t: number) => lerp(lerp(1.3, 0.88, smooth((t - 0.32) / 0.1)), 1, smooth((t - 0.7) / 0.24));
/** The point on the head's form at height `t` and angle `v` round its section (π/2 the front, 0 the figure's left). */
export function headAt(f: HeadForm, t: number, v: number): V3 {
  const pow = (x: number, e: number) => Math.sign(x) * Math.abs(x) ** e;
  const fr = f.front(t), b = f.back(t), c = Math.cos(v), sn = Math.sin(v), e = sn > 0 ? faceRound(t) : 1;
  return [Math.max(0, f.width(t)) * pow(c, e), t * f.h, (fr + b) / 2 + (fr - b) / 2 * pow(sn, e)];
}
/** Whether a point (the head's space) lies inside its form: what hair and a cap are fitted round (hair.ts toHead). */
export function insideHead(f: HeadForm, p: V3): boolean {
  const t = p[1] / f.h;
  if (t <= 0 || t >= 1) return false;
  const W = f.width(t), fr = f.front(t), b = f.back(t), H = (fr - b) / 2, dz = p[2] - (fr + b) / 2, e = dz > 0 ? faceRound(t) : 1;
  return W > 0 && H > 0 && Math.abs(p[0] / W) ** (2 / e) + Math.abs(dz / H) ** (2 / e) < 1;
}
/** The form's outward normal at (t, v), from its own derivatives. */
export function headNormal(f: HeadForm, t: number, v: number): V3 {
  const tt = Math.max(0.004, Math.min(0.996, t)), eps = 1e-3, p = headAt(f, tt, v);
  const n = normalize(cross(sub(headAt(f, tt, v + eps), headAt(f, tt, v - eps)), sub(headAt(f, tt + eps, v), headAt(f, tt - eps, v))));
  return dot(n, [p[0], 0, p[2] - (f.front(tt) + f.back(tt)) / 2]) < 0 ? [-n[0], -n[1], -n[2]] : n;
}
/** A head's skin as one smooth surface: its form's sections, normals from the surface's own derivatives, so it shades as one form. */
function headMesh(f: HeadForm, rings = 22, seg = 20): Mesh {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (let i = 0; i <= rings; i++) for (let j = 0; j < seg; j++) {
    const t = i / rings, v = 2 * Math.PI * j / seg;
    positions.push(...headAt(f, t, v)); normals.push(...headNormal(f, t, v));
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + (j + 1) % seg, d = (i + 1) * seg + j;
    indices.push(a, c, b, a, d, c);
  }
  return { positions, normals, indices };
}
/**
 * The head's form, every size from its genes and its shape from the head's structure (genes.ts HeadShape): the chin,
 * the jaw's underside rising back to its angle under the ear (the neck joins there, under the jaw), the cheekbones at
 * their height, the eyes a little set in under the brow, a forehead, and a cranium round and full behind the ears,
 * tapering over the parietals to the crown (a skull, not a box), its back well behind the neck.
 */
export function headForm(m: Measure, s: Skeleton): HeadForm {
  const g = s.genes, F = m.face, hw = g.head * g.headWidth / 2, hd = g.head * g.headDepth / 2, h = g.head;
  // Depths in half-depths: `z` from the face's set (genes.faceAhead; the face's front at 1), `back` from the cranium's.
  const z = (u: number) => hd * (g.faceAhead + u), back = (u: number) => hd * (g.faceAhead * 0.5 + u);
  const chin = lerp(0.22, 0.34, F.chin), jaw = lerp(0.6, 0.84, F.jaw), cheek = lerp(0.88, 1, F.cheekWidth), cheekT = lerp(0.34, 0.44, F.cheekHeight);
  const width = curve([[0, 0], [0.03, chin * 0.8], [0.08, chin], [0.14, lerp(chin, jaw, 0.6)], [0.21, jaw], [0.29, lerp(0.84, 0.94, F.width)],
    [cheekT, cheek], [0.5, 0.95], [0.62, 0.97], [0.72, 0.95], [0.82, 0.87], [0.9, 0.7], [0.96, 0.44], [1, 0]].map(([t, w]) => [t, w * hw]));
  const crown = (z(0.22) + back(-0.45)) / 2, point = z(0.7) - 0.04 * hd * F.chin;
  // The profile: the chin, the hollow under the lower lip, the lips, the philtrum, the eyes set in, the brow, the forehead.
  const front = curve([[0, point], [0.03, z(0.9)], [0.07, z(0.95 + 0.04 * F.chin)], [0.11, z(0.93)], [0.15, z(0.98 + 0.04 * F.lips)], [0.19, z(0.99 + 0.04 * F.lips)],
    [0.24, z(0.97)], [0.32, z(0.99)], [0.42, z(0.97)], [0.48, z(0.92)], [0.56, z(0.98)], [0.68, z(0.94)], [0.8, z(0.8)], [0.9, z(0.55)], [0.97, z(0.22)], [1, crown]]);
  const backOf = curve([[0, point], [0.04, z(0.5)], [0.1, z(0.1)], [0.18, back(-0.3)], [0.26, back(-0.62)], [0.36, back(-0.86)], [0.5, back(-0.98)],
    [0.62, back(-1.04)], [0.74, back(-1.02)], [0.84, back(-0.9)], [0.92, back(-0.68)], [0.97, back(-0.42)], [1, crown]]);
  return { h, width, front, back: backOf };
}
/** The ears' surfaces: each its own, so the painter's crevice tone draws its rim against its bowl and the head behind it. */
const EAR = { L: 1001, R: 1002 } as const, BOWL = { L: 1003, R: 1004 } as const;
/** The ears' skin: the head's swatch under its own name, so the painter shades each ear by its own form (its normals are
 * not smoothed into the head's round it) and the drawn face never lands on it. */
const earSkin = (skin: string) => `${skin}~ear`;
/** The ear's materials: its rim the skin, lit by its own form (so a rim facing the camera reads light; no glint, which
 * would spot it like a stud), its bowl the
 * skin's shadow and deep (a hollow the light never reaches), so the bowl reads dark inside the rim in any view. */
function earSkins(skin: string, m: Material): Record<string, Material> {
  const t = tonesOf(m).map(c => `#${c.toString(16).padStart(6, '0')}`);
  return { [earSkin(skin)]: { ...m, gloss: undefined, tones: [0.42, -0.2, -0.62] }, [`${earSkin(skin)}~bowl`]: { ...m, gloss: undefined, paint: [t[2], t[2], t[3], t[3]] } };
}
/**
 * An ear (`x` the side, +1 the figure's left), in the head's space, from its height on the head (the brow's line to the
 * nose's foot) and the cranium's depth: its centre, its half-height and half-depth, and the lobe (where a hoop or a stud
 * hangs from). It stands off the side of the head, flaring at its back, so from the front it breaks the
 * head's contour by a texel at the judged size.
 */
export function ear(m: Measure, s: Skeleton, x: number): { c: V3; r: [number, number]; flare: number; lobe: V3 } {
  const g = s.genes, hw = g.head * g.headWidth / 2, hd = g.head * g.headDepth / 2, h = g.head, f = headForm(m, s);
  const t = 0.43, zc = hd * (g.faceAhead * 0.5 - 0.1), mid = (f.front(t) + f.back(t)) / 2, half = (f.front(t) - f.back(t)) / 2;
  // Its root on the head's side at that depth; the lobe at the rim's foot.
  const side = f.width(t) * Math.sqrt(Math.max(0, 1 - ((zc - mid) / half) ** 2)), c: V3 = [x * side, h * t, zc], r: [number, number] = [h * 0.135, hd * 0.23];
  return { c, r, flare: 0.42, lobe: [x * (side + 0.13 * hw), c[1] - r[0] * 0.85, zc] };
}
/**
 * The head: its skin one smooth surface from chin to crown (headForm), a nose standing off the face (in profile it breaks
 * the silhouette) and an ear each side. The face is drawn on the skin (paint.ts); the skin and nose are one surface
 * (FACE_SEAM), so the painter draws no line inside it. Each ear is a bowl (the concha) inside a rim (the helix, running
 * from over the opening round the top and down the back to the lobe), each its own surface, the rim standing proud of
 * the bowl, so the bowl takes the crevice tone inside a lit rim in three-quarter and profile, and the
 * head takes it round the ear.
 */
function head(m: Measure, s: Skeleton, skin: string, ppm = PPM): Part[] {
  const g = s.genes, F = m.face, hw = g.head * g.headWidth / 2, hd = g.head * g.headDepth / 2, h = g.head;
  const z = (u: number) => hd * (g.faceAhead + u);
  const part = (o: Superquadric) => box(J.head, skin, GROUP.head, o, { seam: FACE_SEAM });
  const parts: Part[] = [
    { bone: J.head, material: skin, group: GROUP.head, mesh: headMesh(headForm(m, s)), seam: FACE_SEAM },
    // The nose: the bridge rising from below the brow, set back, sloping out to the ball and wings over the lips (its tip
    // two or three texels proud of the face at the judged size).
    part({ at: [0, h * 0.36, z(0.86)], r: [hw * 0.09, h * 0.1, hd * 0.08], e: [0.6, 0.7], taper: [1.5, 0.7], shear: [0, -lerp(0.08, 0.16, F.bridge) * hd / (h * 0.1)], seg: 8, rings: 5 }),
    part({ at: [0, h * 0.265, z(0.97 + 0.08 * F.bridge)], r: [hw * lerp(0.13, 0.22, F.nose), h * 0.06, hd * 0.13], e: [0.7, 0.7], seg: 8, rings: 5 }),
  ];
  for (const [side, x] of sides) {
    const e = ear(m, s, x), [ry, rz] = e.r, turn = compose(axisAngle([0, 1, 0], -x * e.flare), e.c);
    // In the ear's own plane (y up, z along the head, its back flared out): a point round its outline at angle `a` (0
    // the top, + toward the back), `w` of the way out to it, `out` off the plane.
    const rim = (a: number, w: number, out: number): V3 => apply(turn, [x * out, Math.cos(a) * ry * w, -Math.sin(a) * rz * w]);
    // The bowl: a thin plate on the head; the rim a whole texel thick at the drawing's density, standing proud of it,
    // so its crevice shows at any density.
    const rimR = texels(0.13 * hw, ppm) / 2;
    parts.push({ bone: J.head, material: `${earSkin(skin)}~bowl`, group: GROUP.head, seam: BOWL[side], mesh: superquadric({ at: rim(0, 0, hw * 0.045), r: [hw * 0.045, ry * 0.9, rz * 0.88], e: [0.7, 0.7], seg: 10, rings: 6, turn: axisAngle([0, 1, 0], -x * e.flare) }) });
    // The rim: from over the opening at the front, round the top and down the back, to the lobe, fuller there.
    const path: V3[] = [];
    for (let q = 0; q <= 14; q++) path.push(rim(lerp(-0.9, Math.PI + 0.35, q / 14), 0.8, hw * 0.075 + rimR));
    parts.push({ bone: J.head, material: earSkin(skin), group: GROUP.head, seam: EAR[side], mesh: sweep(path, { r: rimR / hw, flat: 1, tip: 'round', root: 0.1, taper: 1.35 }, hw, p => sub(p, e.c)).mesh });
  }
  return parts;
}
/**
 * A hand as it hangs: the palm turned to the thigh, the fingers curled into it, the thumb standing off its front, so
 * it reads as a loose fist with a thumb (not a mitten) from the side and as a slim hand from the front. Its breadth is
 * the wrist's it hangs from (`w`, the wrist's radii across and front to back, so a thick pixel-build arm gets a hand to
 * match): the palm about 1.4 times the wrist across at the knuckles and a little flatter than it, so the wrist always
 * reads as a notch between forearm and hand; its length is the hands slider's (`u`, metres per unit). `x` the side (+1
 * left).
 */
function hands(bone: number, material: string, group: number, x: number, u: number, w: [number, number]): Part[] {
  // Turned a little so the back of the hand faces forward of the thigh, as a relaxed arm hangs: it shows width from the front.
  const turn = axisAngle([0, 1, 0], -x * 0.22), [wx, wz] = w;
  // The knuckles' half-breadth and the hand's half-thickness, from the wrist's: a hand nearly half again as broad as its wrist.
  const B = 1.45 * wz, T = 0.9 * wx;
  return [
    // The back of the hand and the palm, flaring from the wrist's breadth (its top) to the knuckles' (its foot).
    box(bone, material, group, { at: [x * 0.12 * wx, -0.036 * u, -0.06 * wz], r: [T, 0.036 * u, B], e: [0.45, 0.6], taper: [1, 0.68] }),
    // The fingers, curled in toward the palm, narrower than the knuckles and set back from the palm's front and in from
    // its back: the fist's contour steps at the knuckle row, front and back.
    box(bone, material, group, { at: [-x * 0.2 * wx, -0.085 * u, -0.25 * wz], r: [0.8 * T, 0.027 * u, 0.86 * B], e: [0.7, 0.75], turn: axisAngle([0, 0, 1], -x * 0.4) }),
    // The thumb: off the heel of the hand, standing proud of the palm's front in its top half with its tip turned
    // forward, so it breaks the hand's contour as a nub (a texel at the sprite's size) and its own crevice notches it.
    box(bone, material, group, { at: [-x * 0.35 * wx, -0.045 * u, B + 0.2 * wz], r: [0.55 * wx, 0.03 * u, 0.5 * wz], e: [0.8, 0.8], seg: 8, rings: 5, turn: axisAngle([1, 0, 0], -0.35) }, { seam: THUMB[x > 0 ? 'L' : 'R'] }),
  ].map(p => ({ ...p, mesh: placed(p.mesh, [0, 0, 0], turn) }));
}
/** A bare foot on the foot bone: from a round heel over a low instep to the toes, flat on the floor with no sole, in the
 * skin (one surface with the leg). */
function bareFoot(bone: number, skin: string, group: number, k: number, fw: number, foot: number, ankle: number): Part[] {
  const floor = -ankle, base = floor + 0.004 * k;
  const key = (z: number, high: number, wide: number) => ({ y: z * foot * 0.92, rx: wide * k * fw, rz: high * k * fw, dz: -(base + high * k * fw) });
  const mesh = limb({ seg: 12, caps: [0.04 * foot, 0.03 * foot], e: 0.8, rings: [
    key(0.66, 0.012, 0.03), key(0.5, 0.016, 0.034), key(0.26, 0.026, 0.031), key(0.02, 0.036, 0.026), key(-0.14, 0.03, 0.024),
  ] });
  return [{ bone, material: skin, group, mesh: placed(mesh, [0, 0, 0], axisAngle([1, 0, 0], Math.PI / 2)) }];
}
/**
 * The face as a pixel artist draws it at this size: a texel per eye (two tall when afraid or surprised, a lid when
 * blinking), brows a texel above that slant with the mood, and a mouth that shows only when it means something.
 */
export const EXPRESSIONS = ['neutral', 'fear', 'surprised', 'sad', 'angry', 'talk'] as const;
export type Expression = typeof EXPRESSIONS[number];
function face(s: Skeleton, eyes: string, lid: string, brow: string): Decal[] {
  const g = s.genes, hw = g.head * g.headWidth / 2, hd = g.head * g.headDepth / 2, h = g.head, front = hd * (1 + g.faceAhead) + 0.006;
  const out: Decal[] = [];
  for (const [, x] of sides) {
    const at: V3 = [x * hw * 0.42, h * 0.45, front], normal: V3 = [x * 0.5, 0, 0.86];
    out.push(
      { bone: J.head, at, normal, material: eyes, when: ['neutral', 'sad', 'angry', 'talk'], blink: false },
      { bone: J.head, at: [at[0], h * 0.47, front], normal, material: eyes, size: [1, 2], when: ['fear', 'surprised'], blink: false },
      { bone: J.head, at, normal, material: lid, blink: true },
      // Brows: worried (fear, sad) lifts the inner end, angry drops it.
      { bone: J.head, at: [x * hw * 0.25, h * 0.6, front], normal, material: brow, when: ['fear', 'sad'] },
      { bone: J.head, at: [x * hw * 0.52, h * 0.56, front], normal, material: brow, when: ['fear', 'sad', 'angry'] },
      { bone: J.head, at: [x * hw * 0.25, h * 0.53, front], normal, material: brow, when: ['angry'] },
    );
  }
  out.push(
    { bone: J.head, at: [0, h * 0.2, hd * 0.86], normal: [0, -0.2, 1], material: 'mouth', when: ['fear', 'surprised', 'mouthOpen'] },
    { bone: J.head, at: [0, h * 0.22, hd * 0.86], normal: [0, -0.2, 1], material: 'mouth', size: [2, 1], when: ['sad', 'angry'] },
  );
  // Tagged, so a figure whose face the painter draws leaves them all out (figure.ts).
  return out.map(d => ({ ...d, tag: 'face' }));
}
export type { V3 };
