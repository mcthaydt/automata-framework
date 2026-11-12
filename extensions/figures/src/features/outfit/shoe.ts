import { J, type Side, type Skeleton } from '../body/rig';
import { axisAngle, lerp } from '../../lib/math';
import { limb, placed, profileAt, superquadric, weights, type Limb, type Mesh, type Part, type Ring } from '../body/parts';
import type { Measure } from '../body/genes';

/**
 * The shod foot: the upper's profile (what `garments.ts shoe()` sweeps), and, when a garment kind asks (`Fit.shoe`, a
 * `ShoeForm`), its shaft, heel, thicker sole and toe cap. Every field of a form is optional and none set is today's shoe:
 * the upper's rings are the same numbers, so the mesh is too. The foot stays flat (the foot bone does not pitch, so a
 * heel is carved, never lifted) and the parts a form adds come after every other part of the figure (the part index
 * seeds the painter's grain), except the sole, which keeps its index as the heel's block.
 */
/** The shod foot's form (body() builds it; ignored on a bare foot). Every field optional; none set is today's shoe. */
export interface ShoeForm {
  /** The shaft: 0 none; up the shin to this share of the way from the shoe's top at the ankle to under the knee (0.15 an ankle boot, 0.5 mid, 1 knee). */
  shaft?: number;
  /** A low heel, 0–1 of the most the flat foot allows (0.035 · k): an arch is cut between the heel block and the ball. Over 1 is 1. */
  heel?: number;
  /** The sole's thickness, 1 today's, to 2. It thickens upward: the foot bone and the figure's height do not move. */
  sole?: number;
  /** A toe cap: a swatch on the front fifth of the upper. */
  cap?: string;
}
/** The shod foot's measures (m): its length and width, the shoe's top at the ankle and the knee's height above the floor. */
export interface Foot { length: number; width: number; ankle: number; knee: number }

/** The upper's keys, as `shoe()` has always had them: where along the foot (of its length, + toward the toe), how high
 * (half, of `k · fw`) and how wide (half). */
const KEYS: [z: number, high: number, wide: number][] = [[0.72, 0.022, 0.04], [0.56, 0.027, 0.047], [0.3, 0.042, 0.046], [0.02, 0.058, 0.04], [-0.17, 0.044, 0.034]];
/** The sole box today: its centre's and half-height's share of `k · fw`, its half-width, and its length's extent (of the foot). */
const SOLE_Y = 0.008, SOLE_H = 0.009, SOLE_W = 0.05;
/** The most a heel lifts the foot's arch, of `k`. */
const HEEL = 0.035;
/** Where the heel block ends and the ball's pad begins along the foot (of its length). */
const HEEL_END = 0.1, BALL_START = 0.4;
/** The share of the arch the upper's heel end is lifted by (the heel's block stands under it). */
const HEEL_LIFT = 0.7;

const clampTo = (v: number | undefined, lo: number, hi: number) => Math.max(lo, Math.min(hi, v ?? lo));
/** A form's two lifts, the extra sole and the arch's depth (m), at scale `k` and foot factor `fw`. */
function lifts(k: number, fw: number, form?: ShoeForm) {
  return { thick: 2 * SOLE_H * k * fw * (clampTo(form?.sole, 1, 2) - 1), arch: HEEL * k * clampTo(form?.heel, 0, 1) };
}
/** The arch's share of its depth at a key (of the foot's length): the heel's end lifted, up to the instep's top, back to none by the ball. */
const archAt = (z: number) => (z <= 0.02 ? HEEL_LIFT : z <= 0.3 ? lerp(HEEL_LIFT, 1, (z - 0.02) / 0.28) : z <= 0.56 ? lerp(1, 0, (z - 0.3) / 0.26) : 0);

/**
 * The upper's profile rings along y (heel to toe, the foot's length `foot`), heights off the floor `ankle` below the
 * joint, `fw` the build's foot factor. With a form: each ring's bottom is lifted by the sole's extra thickness and the
 * arch, its top kept (so the shoe's height at the ankle does not move), and with a heel, two rings are added between the
 * keys so the arch is smooth.
 */
function upperRings(k: number, fw: number, foot: number, ankle: number, form?: ShoeForm): Ring[] {
  const floor = -ankle, base = floor + 0.016 * k * fw, { thick, arch } = lifts(k, fw, form);
  const ring = (z: number, high: number, wide: number): Ring => {
    // No form: exactly today's ring (the same numbers in the same order).
    if (!thick && !arch) return { y: z * foot, rx: wide * k * fw, rz: high * k * fw, dz: -(base + high * k * fw) };
    const bottom = base + thick + arch * archAt(z), top = base + 2 * high * k * fw, h = Math.max(top - bottom, 0.8 * high * k * fw) / 2;
    return { y: z * foot, rx: wide * k * fw, rz: h, dz: -(bottom + h) };
  };
  const keys = KEYS.map(([z, high, wide]) => [z, high, wide] as [number, number, number]);
  if (arch) for (const z of [0.16, 0.44]) {
    // Between its neighbours' keys, the ring's own height and width.
    const lo = KEYS.filter(q => q[0] <= z).sort((a, b) => b[0] - a[0])[0], hi = KEYS.filter(q => q[0] > z).sort((a, b) => a[0] - b[0])[0], t = (z - lo[0]) / (hi[0] - lo[0]);
    keys.push([z, lerp(lo[1], hi[1], t), lerp(lo[2], hi[2], t)]);
  }
  return keys.map(([z, high, wide]) => ring(z, high, wide));
}
/** The upper's mesh in the foot bone's space (y up, z toward the toe): the profile swept, turned to lie along z. */
export function upperMesh(k: number, fw: number, foot: number, ankle: number, form?: ShoeForm, grow = 0, span?: [number, number]): Mesh {
  const rings = upperRings(k, fw, foot, ankle, form).map(r => (grow ? { ...r, rx: r.rx + grow, rz: r.rz + grow } : r));
  return placed(limb({ seg: 12, caps: [0.05 * foot, 0.035 * foot], e: 0.85, rings, ...(span ? { span } : {}) }), [0, 0, 0], axisAngle([1, 0, 0], Math.PI / 2));
}
/** The shod foot's measures: the upper's extent (its length and width, to the mesh's own), the shoe's top at the leg's axis,
 * and the knee's height, all above the floor. */
export function footOf(m: Measure, s: Skeleton): Foot {
  const fw = m.foot, foot = s.genes.foot, ankle = s.genes.ankle, k = m.k, P = upperMesh(k, fw, foot, ankle).positions;
  let zLo = Infinity, zHi = -Infinity, xLo = Infinity, xHi = -Infinity;
  for (let i = 0; i < P.length; i += 3) { xLo = Math.min(xLo, P[i]); xHi = Math.max(xHi, P[i]); zLo = Math.min(zLo, P[i + 2]); zHi = Math.max(zHi, P[i + 2]); }
  return { length: zHi - zLo, width: xHi - xLo, ankle: 0.132 * k * fw, knee: s.hipY - s.thigh };
}

/** The sole: today's box under the whole foot, thickened upward by `form.sole`; with a heel, only the heel's block (under the
 * heel and the lifted upper over it), the ball's pad coming after the rest (`ball`). */
export function sole(bone: number, material: string, group: number, k: number, fw: number, foot: number, ankle: number, form?: ShoeForm): Part {
  const floor = -ankle, { thick, arch } = lifts(k, fw, form);
  // The thickness adds to the half-height and lifts the centre by as much, so the sole's bottom stays on the floor (and with none, the numbers are today's).
  if (!arch) return { bone, material, group, mesh: superquadric({ at: [0, floor + SOLE_Y * k * fw + thick / 2, foot * 0.27], r: [SOLE_W * k * fw, SOLE_H * k * fw + thick / 2, foot * 0.52], e: [0.3, 0.45], taper: [1, 0.96], seg: 10, rings: 6 }) };
  // The heel's block: from the foot's heel to under the ankle's far side, its top just inside the lifted upper.
  const lo = floor + (SOLE_Y - SOLE_H) * k * fw, hi = floor + 0.016 * k * fw + thick + arch * HEEL_LIFT + 0.004 * k, len = (HEEL_END + 0.25) * foot;
  return { bone, material, group, mesh: superquadric({ at: [0, (lo + hi) / 2, ((HEEL_END - 0.25) / 2) * foot], r: [0.042 * k * fw, (hi - lo) / 2, len / 2], e: [0.3, 0.45], taper: [1, 0.96], seg: 10, rings: 6 }) };
}
/** The parts a form adds, to come after every other part of the figure (both feet's shafts, then both balls, then both toe
 * caps), each with its seam set (`surfaces()` runs inside `body()` and does not see them): the shafted shoe is one surface
 * per side (3007, 3008) with its shaft, so the shaft's top edge draws against the shin and no line at the ankle; an unshafted
 * one shares the leg's seam as the shoe does today. */
/** What a form's parts are sized from the body: its legs' profiles (fit.ts `Profiles.leg`), the clearance to leave and the foot's measures. */
export interface ShodBody { legs: Record<Side, Limb>; clear: number; foot: Foot }
export function shoeExtras(m: Measure, s: Skeleton, body: ShodBody, upper: string, soleMaterial: string, form: ShoeForm, legGroup: (side: Side) => number, legSeam: (side: Side) => number): Part[] {
  const fw = m.foot, foot = s.genes.foot, ankle = s.genes.ankle, k = m.k, { thick, arch } = lifts(k, fw, form), out: Part[] = [];
  const shaft = clampTo(form.shaft, 0, 1), top = (1 - shaft) * body.foot.ankle + shaft * (body.foot.knee - 0.04 * k);
  const sides: [Side, number][] = [['L', 3007], ['R', 3008]];
  const seam = (side: Side, n: number) => (shaft > 0 ? n : legSeam(side));
  if (shaft > 0) for (const [side, n] of sides) {
    // The leg's own profile from a little inside the shoe's top to the shaft's top, each ring a texel and a half out of the body.
    const leg = body.legs[side], y0 = body.foot.ankle - 0.03 * k, N = 8, c = 1.5 * body.clear;
    const rings = Array.from({ length: N }, (_, i) => { const y = lerp(y0, top, i / (N - 1)), r = profileAt(leg, y); return { ...r, y, rx: r.rx + c, rz: r.rz + c }; });
    const mesh = limb({ seg: 14, rings, caps: [0, 0] });
    out.push({ mesh, material: upper, group: legGroup(side), skin: weights(mesh, () => [[J[`shin.${side}`], 1]]), seam: n });
  }
  if (arch) for (const [side, n] of sides) {
    // The ball's pad: the sole's thickness under the foot's front, where the arch ends.
    // Of the sole's own height (thickened as the form says), so the foot stands on the floor as the plain sole does.
    const floor = -ankle, len = (0.79 - BALL_START) * foot;
    out.push({ bone: J[`foot.${side}`], material: soleMaterial, group: legGroup(side), seam: seam(side, n), mesh: superquadric({ at: [0, floor + SOLE_Y * k * fw + thick / 2, BALL_START * foot + len / 2], r: [SOLE_W * k * fw, SOLE_H * k * fw + thick / 2, len / 2], e: [0.3, 0.45], taper: [1, 0.96], seg: 10, rings: 6 }) });
  }
  if (form.cap) for (const [side, n] of sides) {
    // The upper's front fifth, a hair outside it, in the cap's swatch.
    out.push({ bone: J[`foot.${side}`], material: form.cap, group: legGroup(side), seam: seam(side, n), mesh: upperMesh(k, fw, foot, ankle, form, 0.0012 * k, [Infinity, 0.575 * foot]) });
  }
  return out;
}
/** The seam a shafted shoe's upper and sole take on a side (the shaft's, 3007 and 3008), or undefined (the leg's, by `surfaces()`). */
export const shodSeam = (form: ShoeForm | undefined, side: Side): number | undefined => ((form?.shaft ?? 0) > 0 ? (side === 'L' ? 3007 : 3008) : undefined);
