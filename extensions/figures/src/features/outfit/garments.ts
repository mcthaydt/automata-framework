import { J, type Side, type Skeleton } from '../body/rig';
import { apply, axisAngle, compose, lerp, smooth, sub, type V3 } from '../../lib/math';
import { GROUP, limb, placed, superquadric, weights, type Decal, type Limb, type Material, type Part, type Superquadric } from '../body/parts';
import type { HeadShape, Measure } from '../body/genes';
import { FACE_SEAM, tonesOf } from '../paint/paint';
import swatchLibrary from './library/swatches.json';
import type { Anchor } from '../motion/motion';
import { ear, headForm, headMesh } from '../body/head';
import { hexOf } from '../../lib/colour';
import { hairParts, sweep, texels, HAIR_STYLES, PPM, type HairStyle } from '../hair/hair';
/**
 * The body and what the base pair wears. A character is sliders (genes.ts) plus a list of garments, each fitted to the
 * body the sliders make: a top painted on the torso and as much of the arms as its sleeves cover, shorts painted on the
 * hips and thighs, a hair style from the generator's pieces (hair.ts), and the eyes, whose lids, brows and mouth are
 * marks (decals that an expression changes) unless the painter draws the face (paint.ts). The body is profiled limbs
 * (parts.ts), each one surface, with a head (head form, ears, nose), hands and bare feet. Colours are named DUEL
 * swatches (library/swatches.json). A fork adds its wardrobe beside this, in its own feature folder.
 */
/** The group (parts.ts GROUP) of a side's arm and of its leg: the parts a garment adds to a limb carry it, so the limb's
 * surface rules (the body's seams, the painter's layers) treat them as that limb's. */
export const armGroup = (side: Side) => (side === 'L' ? GROUP.armL : GROUP.armR), legGroup = (side: Side) => (side === 'L' ? GROUP.legL : GROUP.legR);
/** Both sides with the sign of their x: the left is +x, the right −x. */
export const sides = [['L', 1], ['R', -1]] as const;
/** A rounded box: the kit's one primitive. */
export const box = (bone: number, material: string, group: number, o: Superquadric, extra: Partial<Part> = {}): Part => ({ bone, material, group, mesh: superquadric({ e: [0.5, 0.55], seg: 10, rings: 6, ...o }), ...extra });

// ─── Swatches: named DUEL ramp rows and steps (src/features/paint/duel-ramps.ts), from the library (library/swatches.json) ───
/** The shared palette library; a character file adds its own swatches (cast.ts). Every colour is DUEL-checked (tests). */
export const SWATCHES = swatchLibrary as unknown as Record<string, Material>;

// ─── Garments ───
/** The garments the base pair wears (the union a fork widens through GarmentKinds, below). */
export type BaseGarment =
  /** A top painted on the torso, and as much of the arms as its sleeves cover (the base pair's: none). */
  | { top: string; sleeves?: 'none' | 'short' | 'long'; cuffs?: string; collar?: string }
  /** Shorts painted on the body (the hips and thighs), with no cloth of their own: a base figure's modest block. */
  | { shorts: string }
  /** `tie`: the band a pony or a bun is tied with (a swatch); left out, a band of the hair's own. */
  | { hair: string; style: string | HairStyle; tie?: string }
  /** The eyes, the marks face's lids and brows, and the drawn face's (paint.ts) whites and lips. */
  | { eyes: string; stubble?: string; lids?: string; brows?: string; white?: string; lips?: string };
/** A library entry by name, or the entry itself where one is given in place of a name; throws on a name the library lacks. */
export const named = <T>(library: Record<string, T>, kind: string, style: string | T): T => {
  if (typeof style !== 'string') return style;
  const found = library[style]; if (!found) throw new Error(`no ${kind} ${style}`); return found;
};
/** Materials of the body's regions; garments repaint them. */
export interface Regions { skin: string; chest: string; waist: string; pelvis: string; shoulder: string; upper: string; fore: string; hand: string; thigh: string; knee: string; shin: string; shoe: string; sole: string; neck: string }
/** A dressed body: its parts and marks, any materials the outfit makes for itself, its face, and the openings a hand can
 * reach (motion.ts Anchor). Base's garments publish none, so a hand finds the body's own hip (motion.ts openings); a
 * fork's wardrobe publishes its pockets and hems here. */
export interface Look { parts: Part[]; decals: Decal[]; materials?: Record<string, Material>; face?: FaceLook; anchors?: Anchor[] }
/** What the painter's drawn face takes from the outfit (paint.ts): the head's structure, and its colours as swatch names. */
export interface FaceLook { shape: HeadShape; eyes?: string; white?: string; brows?: string; lips?: string }

// ─── Hooks: how a fork adds garments and tunes the outfit, with nothing registered in base ───
/**
 * What a registered garment kind's builder is given (H1, `registerGarment`): the body, the whole outfit, the swatches,
 * the density, the parts worn so far (not the body's own: `worn` is the very array dress() fills, so a kind built last
 * sees every part worn by then), and a scratch record the outfit's kinds share for the length of one dress() (an apron
 * reads there what a coat published, so it clears it).
 */
export interface Wearing {
  m: Measure; s: Skeleton; garments: Garment[];
  swatch: (name: string) => Material; swatches: Record<string, Material>;
  ppm?: number; worn: Part[]; state: Record<string, unknown>;
}
/** What a garment kind makes (H1), applied by dress() in this order: its parts, its marks, its materials, the body
 * regions it repaints (`paint`), and the openings a hand can reach (`anchors`, motion.ts Anchor). */
export interface Fit {
  parts: Part[]; decals?: Decal[]; materials?: Record<string, Material>;
  paint?: Partial<Regions>; anchors?: Anchor[];
  /** false: the body draws no thighs under it (a long skirt or coat). And-ed across the outfit. */
  thighs?: boolean;
}
/** A garment kind a fork registers (H1): how its items are built, and when in the outfit they are worn. */
export interface GarmentKind<T = any> {
  /** The item's fit, built in garment order with the outfit's other kinds. */
  build(c: Wearing, item: T): Fit;
  /** Built after the rest of the outfit, on what is worn by then (a belt over the coat, shades pushed up). */
  last?: boolean;
  /** Built after the `last` kinds, in garment order (boots' shafts, over the shins the rest has drawn). */
  after?(c: Wearing, item: T): Fit;
  /** Headwear: the hair is drawn under it (HairInput `capped`). `press`, if it returns one, fits the hair's parts inside
   * the headwear's dome. */
  coversHair?(c: Wearing, item: T): { press?: (hair: Part[]) => Part[] };
}
/**
 * The garment kinds a fork adds to the union of Garment, by augmentation: a fork declares
 * `declare module '…/outfit/garments' { interface GarmentKinds { tee: Tee } }` for each kind it registers
 * (`registerGarment`), and its items then typecheck as garments. Empty in base.
 */
export interface GarmentKinds {}
/** Any garment: the base pair's, or one of the kinds a fork registers (GarmentKinds). */
export type Garment = BaseGarment | GarmentKinds[keyof GarmentKinds];
/**
 * What a fork tunes in dress() without editing it (H2, `registerOutfitHooks`). Both are callbacks base never sets.
 */
export interface OutfitHooks {
  /** The hair's tie when its entry names none (the wardrobe: the outfit's first metal swatch). */
  tie?(garments: Garment[], swatches: Record<string, Material>): string | undefined;
  /** The openings a hand can reach, from the anchors the kinds published (each with the garment that made it) and every
   * part dressed (the body's included), in place of the kinds' anchors as they stand (the wardrobe: those a hand can
   * reach, and a pendant's where no chain publishes one). */
  anchors?(c: Wearing, worn: { anchor: Anchor; from: Garment }[], parts: Part[]): Anchor[];
}
/** The garment kinds a fork registers (registerGarment), by name, in registration order. Empty in base. */
const KINDS = new Map<string, GarmentKind>();
/** Registers a garment kind under `kind`, the key its items carry ({ tee: 'iceTee', … }). Throws on a name taken. */
export function registerGarment(kind: string, entry: GarmentKind): void {
  if (KINDS.has(kind)) throw new Error(`garment kind ${kind} is registered already`);
  KINDS.set(kind, entry);
}
/** The registered kind an item is, if any: the first, in registration order, whose name is one of its keys. */
const kindOf = (item: object): GarmentKind | undefined => { for (const [k, e] of KINDS) if (k in item) return e; return undefined; };
/** The outfit hooks a fork installs (registerOutfitHooks). None in base. */
let hooks: OutfitHooks = {};
let hooked = false;
/** Installs the outfit hooks (H2), once: a second registration throws. */
export function registerOutfitHooks(h: OutfitHooks): void {
  if (hooked) throw new Error('outfit hooks are registered already');
  hooks = h; hooked = true;
}
/**
 * Dresses a body: the garments in order repaint regions and add parts, then the body is built under them. Returns
 * the parts and decals, every one sized from the measure; `ppm` the texels a metre it is drawn at (the cell's), so the
 * small features (a hair tie, an ear's rim) land on whole texels at any density. A fork's registered kinds (H1) are worn
 * at their place in the garment order, those built `last` and then their `after` once the rest is on; the outfit hooks
 * (H2) set the hair's tie where the entry names none and pick the anchors. With none registered, none of that runs.
 */
export function dress(m: Measure, s: Skeleton, skin: string, garments: Garment[], swatches: Record<string, Material> = SWATCHES, ppm?: number): Look {
  const swatch = (name: string): Material => { const found = swatches[name]; if (!found) throw new Error(`no swatch ${name}`); return found; };
  const g = s.genes, k = m.k, t = m.thick, hw = g.head * g.headWidth / 2, hd = g.head * g.headDepth / 2, h = g.head;
  const r: Regions = { skin, chest: skin, waist: skin, pelvis: skin, shoulder: skin, upper: skin, fore: skin, hand: skin, thigh: skin, knee: skin, shin: skin, shoe: skin, sole: skin, neck: skin };
  const parts: Part[] = [], decals: Decal[] = [], made: Record<string, Material> = {};
  let thighs = true, faceLook: FaceLook = { shape: m.face };
  // What the registered kinds are given, and the anchors they publish, each with the garment that made it.
  const state: Record<string, unknown> = {}, anchors: { anchor: Anchor; from: Garment }[] = [];
  const c: Wearing = { m, s, garments, swatch, swatches, ppm, worn: parts, state };
  /** A kind's fit, applied in order: its parts, marks, materials, the regions it repaints, its openings. */
  const wear = (f: Fit, from: Garment) => {
    parts.push(...f.parts); decals.push(...f.decals ?? []); Object.assign(made, f.materials); Object.assign(r, f.paint);
    for (const anchor of f.anchors ?? []) anchors.push({ anchor, from });
    if (f.thighs === false) thighs = false;
  };
  for (const item of garments) {
    // A registered kind (a fork's wardrobe); one worn last waits for the rest of the outfit.
    const kind = kindOf(item);
    if (kind) { if (!kind.last) wear(kind.build(c, item), item); continue; }
    if ('top' in item) {
      r.chest = r.waist = item.top;
      // A sleeveless top leaves the shoulder's round bare: the arm one surface of skin from the shoulder to the hand.
      if (item.sleeves !== 'none') r.shoulder = item.top;
      if (item.sleeves !== 'none') r.upper = item.top;
      if (item.sleeves === 'long') r.fore = item.top;
      if (item.cuffs) for (const [side] of sides) parts.push(item.sleeves === 'long'
        ? box(J[`foreArm.${side}`], item.cuffs, armGroup(side), { at: [0, -s.foreArm * 0.9, 0], r: [0.048 * k * t * m.arm, 0.022 * k, 0.05 * k * t * m.arm], e: [0.45, 0.6] })
        : box(J[`upperArm.${side}`], item.cuffs, armGroup(side), { at: [0, -s.upperArm * 0.86, 0], r: [0.056 * k * t * m.arm, 0.02 * k, 0.058 * k * t * m.arm], e: [0.45, 0.6] }));
      if (item.collar) for (const [, x] of sides) parts.push(box(J.chest, item.collar, GROUP.torso, { at: [x * 0.04 * k, 0.172 * k, 0.045 * k], r: [0.04 * k, 0.018 * k, 0.04 * k], turn: axisAngle([0, 1, 0], x * 0.5), e: [0.35, 0.5] }));
    } else if ('shorts' in item) { r.pelvis = r.thigh = item.shorts; }
    // The hair: the generators' pieces (hair.ts), one surface, so the painter draws no line between them.
    else if ('hair' in item) {
      const style = typeof item.style === 'string' ? named(HAIR_STYLES, 'hair style', item.style) : item.style;
      // The tie in the wearer's own palette: the one it names, else a band of the hair's own. The trunk the hair falls
      // clear of: the tops worn by now over the body's own torso.
      const tie = item.tie ?? hooks.tie?.(garments, swatches);
      const trunk = [...parts, ...body(m, s, r, thighs)].filter(p => p.group === GROUP.torso);
      // Headwear in the outfit: the hair is drawn under it, and pressed inside it where the headwear says how.
      const hat = garments.find(g => kindOf(g)?.coversHair), cover = hat && kindOf(hat)!.coversHair!(c, hat);
      const hair = hairParts({ m, s, hair: item.hair, skin, swatch, capped: !!hat, ppm, tie, trunk }, style);
      parts.push(...(cover?.press ? cover.press(hair.parts) : hair.parts)); decals.push(...hair.decals); Object.assign(made, hair.materials);
    } else if ('eyes' in item) {
      decals.push(...face(s, item.eyes, item.lids ?? 'lid', item.brows ?? 'brow'));
      faceLook = { shape: m.face, eyes: item.eyes, white: item.white, brows: item.brows, lips: item.lips };
      if (item.stubble) parts.push(box(J.head, item.stubble, GROUP.head, { at: [0, h * 0.12, hd * 0.52], r: [hw * 0.72, h * 0.12, hd * 0.5], e: [0.6, 0.65], taper: [0.7, 1] }, { seam: FACE_SEAM }));
    }
  }
  // The kinds worn last, then each kind's `after`, both in garment order.
  for (const item of garments) { const kind = kindOf(item); if (kind?.last) wear(kind.build(c, item), item); }
  for (const item of garments) { const kind = kindOf(item); if (kind?.after) wear(kind.after(c, item), item); }
  Object.assign(made, earSkins(skin, swatch(skin)));
  const all = [...body(m, s, r, thighs, ppm), ...parts];
  return { parts: all, decals, materials: made, face: faceLook, anchors: hooks.anchors?.(c, anchors, all) ?? anchors.map(w => w.anchor) };
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
export const TRAPEZIUS = 0.6;
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
    // ─── Foot: a shoe from the heel's round over the instep to the toe, on its sole ───
    parts.push(...(r.shoe === r.skin ? bareFoot(J[`foot.${side}`], r.skin, lg, k, fw, foot, ankle) : shoe(J[`foot.${side}`], r.shoe, r.sole, lg, k, fw, foot, ankle)));
  }
  return surfaces(parts);
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
  const t = tonesOf(m).map(hexOf);
  return { [earSkin(skin)]: { ...m, gloss: undefined, tones: [0.42, -0.2, -0.62] }, [`${earSkin(skin)}~bowl`]: { ...m, gloss: undefined, paint: [t[2], t[2], t[3], t[3]] } };
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
/** A bare foot on the foot bone, where no shoe is worn: lower and narrower than a shoe, from a round heel over a low
 * instep to the toes, flat on the floor with no sole, in the skin (one surface with the leg). */
function bareFoot(bone: number, skin: string, group: number, k: number, fw: number, foot: number, ankle: number): Part[] {
  const floor = -ankle, base = floor + 0.004 * k;
  const key = (z: number, high: number, wide: number) => ({ y: z * foot * 0.92, rx: wide * k * fw, rz: high * k * fw, dz: -(base + high * k * fw) });
  const mesh = limb({ seg: 12, caps: [0.04 * foot, 0.03 * foot], e: 0.8, rings: [
    key(0.66, 0.012, 0.03), key(0.5, 0.016, 0.034), key(0.26, 0.026, 0.031), key(0.02, 0.036, 0.026), key(-0.14, 0.03, 0.024),
  ] });
  return [{ bone, material: skin, group, mesh: placed(mesh, [0, 0, 0], axisAngle([1, 0, 0], Math.PI / 2)) }];
}
/** A shoe on the foot bone: one profile from the heel along to the toe (heights off the floor `ankle` below the joint),
 * and its sole. `fw` the build's foot factor, `foot` its length. */
function shoe(bone: number, upper: string, sole: string, group: number, k: number, fw: number, foot: number, ankle: number): Part[] {
  const floor = -ankle, base = floor + 0.016 * k * fw;
  // Authored along y (heel to toe) with z as minus the height, then turned so y runs forward and z up.
  const key = (z: number, high: number, wide: number) => ({ y: z * foot, rx: wide * k * fw, rz: high * k * fw, dz: -(base + high * k * fw) });
  const mesh = limb({ seg: 12, caps: [0.05 * foot, 0.035 * foot], e: 0.85, rings: [
    key(0.72, 0.022, 0.04), key(0.56, 0.027, 0.047), key(0.3, 0.042, 0.046), key(0.02, 0.058, 0.04), key(-0.17, 0.044, 0.034),
  ] });
  return [
    { bone, material: upper, group, mesh: placed(mesh, [0, 0, 0], axisAngle([1, 0, 0], Math.PI / 2)) },
    box(bone, sole, group, { at: [0, floor + 0.008 * k * fw, foot * 0.27], r: [0.05 * k * fw, 0.009 * k * fw, foot * 0.52], e: [0.3, 0.45], taper: [1, 0.96] }),
  ];
}
/**
 * The face as a pixel artist draws it at this size: a texel per eye (two tall when afraid or surprised, a lid when
 * blinking), brows a texel above that slant with the mood, and a mouth that shows only when it means something.
 */
export const EXPRESSIONS = ['neutral', 'fear', 'surprised', 'sad', 'angry', 'talk', 'smile', 'dead'] as const;
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
