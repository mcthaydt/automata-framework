/**
 * Small math for the procedural figures: vectors, quaternions and affine matrices as plain arrays,
 * so the rig runs the same in Node (tests, sheets) and the browser.
 */
export type V3 = [number, number, number];
/** A unit quaternion, [x, y, z, w]. */
export type Q = [number, number, number, number];
/** An affine transform, row-major 3x3 rotation then the translation: [r00 r01 r02 r10 r11 r12 r20 r21 r22 tx ty tz]. */
export type M = number[];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: V3): V3 => { const l = length(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const smooth = (k: number) => { const t = clamp(k, 0, 1); return t * t * (3 - 2 * t); };

export const IDENTITY_Q: Q = [0, 0, 0, 1];
export function axisAngle(axis: V3, angle: number): Q {
  const [x, y, z] = normalize(axis), s = Math.sin(angle / 2);
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}
export function qmul(a: Q, b: Q): Q {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
/** Pitch about x, then yaw about y, then roll about z, applied as yaw · pitch · roll (a head or a limb's swing). */
export function euler(pitch: number, yaw: number, roll: number): Q {
  return qmul(qmul(axisAngle([0, 1, 0], yaw), axisAngle([1, 0, 0], pitch)), axisAngle([0, 0, 1], roll));
}
/** A rotation matrix (row-major 3x3) from a quaternion. */
export function qmat(q: Q): number[] {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
}
/** A quaternion from a rotation matrix (row-major 3x3). */
export function matq(m: number[]): Q {
  const t = m[0] + m[4] + m[8];
  let q: Q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [(m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s, s / 4]; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; q = [s / 4, (m[1] + m[3]) / s, (m[2] + m[6]) / s, (m[7] - m[5]) / s]; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; q = [(m[1] + m[3]) / s, s / 4, (m[5] + m[7]) / s, (m[2] - m[6]) / s]; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; q = [(m[2] + m[6]) / s, (m[5] + m[7]) / s, s / 4, (m[3] - m[1]) / s]; }
  const l = Math.hypot(...q); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
/** A matrix whose columns are the basis vectors x, y, z (each the image of a local axis). */
export function basis(x: V3, y: V3, z: V3): number[] { return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]; }

export function compose(rotation: Q, translation: V3): M { return [...qmat(rotation), ...translation]; }
/** a · b: b first, then a. */
export function mmul(a: M, b: M): M {
  const o: M = new Array(12);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  for (let r = 0; r < 3; r++) o[9 + r] = a[r * 3] * b[9] + a[r * 3 + 1] * b[10] + a[r * 3 + 2] * b[11] + a[9 + r];
  return o;
}
export function apply(m: M, p: V3): V3 {
  return [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[9], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + m[10], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + m[11]];
}
export function applyDir(m: M, v: V3): V3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
/** The inverse of a rigid transform (rotation and translation only). */
export function invertRigid(m: M): M {
  const r = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  const t = [m[9], m[10], m[11]];
  return [...r, -(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]), -(r[3] * t[0] + r[4] * t[1] + r[5] * t[2]), -(r[6] * t[0] + r[7] * t[1] + r[8] * t[2])];
}
export const position = (m: M): V3 => [m[9], m[10], m[11]];
/** Deterministic hash noise in [0, 1) for an integer, for twitches and part jitter that must repeat exactly. */
export function hash(n: number) { let x = Math.imul(n | 0, 0x27d4eb2d); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x ^= x >>> 13; return (x >>> 0) / 4294967296; }
