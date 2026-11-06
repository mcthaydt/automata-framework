import type { Side, Skeleton } from '../body/rig';
import { GROUP, type Part, type Ring } from '../body/parts';
import { ringAt, type Profiles, type Region } from '../outfit/fit';

/**
 * Cloth coordinates for the fabric registry (paint/fabric.ts): where on its cloth each vertex of a figure lies, so a tile
 * lays on the body without a jump at a part or a seam, without shear on a flank, and fixed to the body as it moves.
 *
 * Each group is mapped round its own cylinder: the torso (with a skirt) round the trunk's axis, a cape round the same trunk
 * with its wrap turned to the front, each arm and leg round its own. In the rest pose every limb hangs straight down, so every axis is vertical. A vertex's angle `t` is
 * taken on the body's own ring at its rest height (so the side seam does not wander with bust and seat), and `u` is the
 * arc length round the group's ellipse at that angle; `v` is the height. `u` depends on the angle alone and `v` on the
 * height alone, so there is no shear. The pattern jumps only on one wrap line per group (centre back, as a skirt's seam is; centre
 * front for a cape, which has no seam at its middle; the inside of each limb) and where groups meet (the armhole, the top of the thigh), as tailoring seams do. The head and held items are
 * untiled.
 *
 * What a vertex stores is `(cos t, sin t, −y)`, not the angle, so the resolve's averaging stays sound across the wrap: a
 * triangle that spans it interpolates a chord, not a jump through zero. `clothU` turns a texel's `(cos, sin)` back into
 * metres.
 */
export interface Cylinder {
  A: number; B: number;
  /** 0: the trunk (the angle runs from centre front, the wrap at centre back); 2: a cape (the same trunk, the wrap at centre
   * front); 1 and −1: a limb on its left or right (the wrap on the inside). */
  side: 2 | 1 | -1 | 0;
  /** The ellipse's arc length (m) at 257 angles from −π to π, zero at the angle 0. */
  arc: Float32Array;
  /** The body's ring at rest height `y` (clamped past its end keys). */
  ring(y: number): Ring;
}
/** The cylinders by group (parts.ts GROUP). A group with none is untiled. */
export type ClothFrame = Map<number, Cylinder>;
const N = 256;
/**
 * The arc length round an ellipse as the angle runs from −π to π (trapezium rule), shifted so that entry 128 (the angle 0)
 * is 0. The torso's angle `t = atan2(X, Z)` puts its point at `(A sin t, B cos t)`, speed `hypot(A cos t, B sin t)`; a
 * limb's `t = atan2(Z, side · X)` puts it at `(side · A cos t, B sin t)`, speed `hypot(A sin t, B cos t)`.
 */
export function arcOf(A: number, B: number, limb: boolean): Float32Array {
  const speed = (t: number) => (limb ? Math.hypot(A * Math.sin(t), B * Math.cos(t)) : Math.hypot(A * Math.cos(t), B * Math.sin(t)));
  const arc = new Float32Array(N + 1), h = 2 * Math.PI / N, acc: number[] = [0];
  for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + h * (speed(-Math.PI + (i - 1) * h) + speed(-Math.PI + i * h)) / 2);
  for (let i = 0; i <= N; i++) arc[i] = acc[i] - acc[N / 2];
  return arc;
}
const mean = (rings: Ring[], f: (r: Ring) => number) => rings.reduce((n, r) => n + f(r), 0) / rings.length;
function cylinder(p: Profiles, region: Region, side: Side, sign: 2 | 1 | -1 | 0): Cylinder {
  const rings = region === 'torso' ? p.torso.rings : p[region as 'arm' | 'leg'][side].rings;
  const A = mean(rings, r => r.rx), B = mean(rings, r => r.rz);
  return { A, B, side: sign, arc: arcOf(A, B, region !== 'torso'), ring: y => ringAt(p, region, side, y) };
}
/**
 * The cylinders of a body: the torso (shared by a skirt: its centre-back seam is real tailoring), a cape's own (the trunk's
 * shape, the wrap at centre front, so a check does not jump down the middle of a cape seen from behind), each arm and each leg.
 */
export function clothFrame(p: Profiles): ClothFrame {
  const f: ClothFrame = new Map(), trunk = cylinder(p, 'torso', 'L', 0);
  for (const g of [GROUP.torso, GROUP.skirt]) f.set(g, trunk);
  f.set(GROUP.cape, cylinder(p, 'torso', 'L', 2));
  f.set(GROUP.armL, cylinder(p, 'arm', 'L', 1)); f.set(GROUP.armR, cylinder(p, 'arm', 'R', -1));
  f.set(GROUP.legL, cylinder(p, 'leg', 'L', 1)); f.set(GROUP.legR, cylinder(p, 'leg', 'R', -1));
  return f;
}
/** One rest point's cloth slots `(cos t, sin t, −y)` on a cylinder. */
export function slotAt(c: Cylinder, x: number, y: number, z: number): [number, number, number] {
  const R = c.ring(y), X = (x - (R.dx ?? 0)) / R.rx, Z = (z - (R.dz ?? 0)) / R.rz;
  // The trunk's angle runs from centre front; a cape's from centre back (the trunk's turned half a circle, the speed the same).
  const t = c.side === 0 ? Math.atan2(X, Z) : c.side === 2 ? Math.atan2(-X, -Z) : Math.atan2(Z, c.side * X);
  return [Math.cos(t), Math.sin(t), -y];
}
/**
 * The cloth slots of every vertex of `parts`, three each, in part order (the soup's vertex order). A rigid part's rest
 * position is its mesh's plus its bone's rest (rest rotations are the identity), a skinned part's mesh is in rest figure
 * space. An untiled group's slots are zero. Computed once per build, never per pose, which is what keeps the pattern fixed
 * to the body.
 */
export function clothSlots(parts: Part[], s: Skeleton, f: ClothFrame): Float32Array {
  let n = 0;
  for (const p of parts) n += p.mesh.positions.length / 3;
  const out = new Float32Array(n * 3);
  let vi = 0;
  for (const p of parts) {
    const pos = p.mesh.positions, c = f.get(p.group), r = p.bone === undefined ? [0, 0, 0] : s.rest[p.bone];
    for (let i = 0; i < pos.length; i += 3, vi++) {
      if (!c) continue;
      out.set(slotAt(c, pos[i] + r[0], pos[i + 1] + r[1], pos[i + 2] + r[2]), vi * 3);
    }
  }
  return out;
}
/** `u` (m) round a group's cylinder for a texel's `(cos t, sin t)`, or null for an untiled group. */
export function clothU(f: ClothFrame, group: number, c: number, sn: number): number | null {
  const cyl = f.get(group);
  if (!cyl) return null;
  const q = (Math.atan2(sn, c) + Math.PI) / (2 * Math.PI) * N, i = Math.min(N - 1, Math.floor(q)), w = q - i;
  return cyl.arc[i] * (1 - w) + cyl.arc[i + 1] * w;
}
