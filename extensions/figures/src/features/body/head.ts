import type { Skeleton } from './rig';
import { cross, dot, lerp, normalize, smooth, sub, type V3 } from '../../lib/math';
import type { Mesh } from './parts';
import type { Measure } from './genes';
/**
 * The head's form: a skull and a face as one surface of revolution in the head's space, its width, front and back
 * profiles keyed along its height (curve), from the measure's head structure (genes.ts HeadShape); and the ears on it.
 * The body's head mesh (garments.ts head) is built from it and the hair (hair.ts) is laid on it, so every style fits
 * every head.
 */
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
export function headMesh(f: HeadForm, rings = 22, seg = 20): Mesh {
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
