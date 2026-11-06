import { add, apply, applyDir, compose, cross, dot, lerp, normalize, scale, sub, IDENTITY_Q, type Q, type V3 } from '../../lib/math';
/**
 * Part meshes for the procedural figures smooth-normalled parametric primitives (a tapered
 * superquadric covers heads, limbs, torsos and boxes), each either
 * rigid on one bone (authored in the bone's space) or skinned to up to three bones (authored in rest figure space).
 */
export interface Mesh { positions: number[]; normals: number[]; indices: number[] }
/** A DUEL ramp row (src/features/paint/duel-ramps.ts) and the step a lit-but-unhighlighted surface sits on. `lift` 0 or less: the
 * painter gives it no highlight step (dark cloth, the torch's wood). */
export interface Material {
  ramp: number; base: number; lift?: number; flat?: boolean;
  /** Glossy (hair, shoes, buckles): a glint two steps up where the surface faces the form light past this (0–1). */
  gloss?: number;
  /** Grain drawn as strands along the part (hair). */
  strands?: boolean;
  /** Glossy hair (a straight or sleek finish): the painter lays its sheen band round the crown (paint.ts SHEEN). */
  sheen?: boolean;
  /** Fine vertical folds in the painter (paint.ts): how far the strand noise moves cloth along its ramp, 0 for none. */
  streaks?: number;
  /** The painter's hand-picked ramp (paint.ts), light → mid → shadow → deep, as hex; else four steps of the DUEL row. */
  paint?: string[];
  /** Its own key-light thresholds (paint.ts), where the style's do not suit it (skin sits mostly on its light tone). */
  tones?: [number, number, number];
  /** A blend of two ramps, the painter's to mix (paint.ts tonesOf), in place of `paint`: `at` of the way from each of
   * `from`'s tones to `to`'s (a fade's tier: the hair's toward the skin's). */
  mix?: { from: string[]; to: string[]; at: number };
  /** A stain (paint.ts): from `hem` up to `below` (m, in the surface's rest space) a texel takes this ramp, surely at the
   * hem and ever less often up to `below`, in runs that climb like drips (the Nurse's hem); on trousers and a seat, a
   * wash instead (a fade on the thighs' fronts, whiskers at the hip and behind the knee). */
  stain?: { paint: string[]; hem: number; below: number };
  /** Iridescent (paint.ts): its tone runs along its paint ramp (cyan → violet, light → deep) by how each texel turns
   * to the key and the eye, not by the light alone, so the colour slides across it as the figure turns. `'mirror'`, a
   * mirrored lens: a dark tint, the ramp only on its top edge where it faces the key, and one glint. */
  holo?: boolean | 'mirror';
  /** A tinted lens (paint.ts): the eyes under it show through, faintly, in its dark. */
  see?: boolean;
}
/** The figure's part groups: what moves and outlines as one (the trunk, the head and hair, each limb, a held item). */
export const GROUP = { torso: 0, head: 1, hair: 1, armL: 3, armR: 4, legL: 5, legR: 6, item: 7, skirt: 8, cape: 9 } as const;
export interface Part {
  mesh: Mesh;
  material: string;
  /** Parts in the same group never draw an inner contour line between them. */
  group: number;
  /** Rigid: the bone whose space the mesh is in. */
  bone?: number;
  /** Skinned: per vertex, up to three [bone, weight] pairs; the mesh is in rest figure space. */
  skin?: [number, number][][];
  /** A tag that marks a part for the generators (the hair's crown: hair.ts CROWN; the body's neck: outfit/garments.ts NECK, for the raster's neckline rule). */
  tag?: string;
  /** Parts sharing a seam number draw no crevice between them (one surface built from several pieces). */
  seam?: number;
}
/** A point mark (an eye, a button): drawn where its surface faces the camera and is not hidden. */
export interface Decal {
  bone: number; at: V3; normal: V3; material: string; size?: [number, number]; tag?: string;
  /** Facial marks: the face states (an expression, or 'mouthOpen') it shows in; always when left out. */
  when?: string[];
  /** true: only while the eyes blink; false: never while they do. */
  blink?: boolean;
  /** Only at these cell densities (paint.ts densityOf), lowest and highest: detail that needs the texels, or the bolder
   * mark that stands in for it below. */
  density?: [number, number];
  /** A print (a brand mark) stamped flat in the cell at this point, its top's centre (raster.ts stampPrint). */
  print?: Print;
}
/** A print laid flat in the cell rather than texel by texel on the cloth (raster.ts stampPrint): its bitmap (each
 * character a material from `inks`, '#' the decal's own by default; ',' a gap between letters, which closes as the
 * cloth turns from the camera; '.' none), its across (as the viewer reads it) and down directions on the cloth in the
 * bone's space, a bitmap texel's size (m), and the surface it is printed on (its seams): it shows on that surface's
 * visible texels only, or, with none, over whatever lies behind it (a pendant). */
export interface Print { rows: string[]; u: V3; v: V3; texel: number; seams?: number[]; inks?: Record<string, string> }

const sgnPow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;
export interface Superquadric {
  /** Centre and radii in the part's space (before `turn`), roundness (1 a sphere, ~0.3 a rounded box) along latitude and longitude. */
  at: V3; r: V3; e?: [number, number];
  /** Scales x and z from the bottom (−y) to the top (+y), for limbs that narrow. */
  taper?: [number, number];
  /** Shift x and z by this much per unit of height (from −1 at the bottom to +1 at the top), for a slanted shape. */
  shear?: [number, number];
  turn?: Q;
  seg?: number; rings?: number;
  /** Keep only the triangles whose centroid (in the primitive's own unit space, before taper) passes. */
  keep?: (x: number, y: number, z: number) => boolean;
}
/** A tapered superquadric with normals from the surface's own derivatives, so tapers and rounded boxes shade smoothly. */
export function superquadric(o: Superquadric): Mesh {
  const [rx, ry, rz] = o.r, [e1, e2] = o.e ?? [1, 1], [t0, t1] = o.taper ?? [1, 1], [hx, hz] = o.shear ?? [0, 0];
  const seg = o.seg ?? 10, rings = o.rings ?? 7, turn = o.turn ?? IDENTITY_Q;
  const m = compose(turn, o.at);
  const unit = (u: number, v: number): V3 => [sgnPow(Math.cos(u), e1) * sgnPow(Math.cos(v), e2), sgnPow(Math.sin(u), e1), sgnPow(Math.cos(u), e1) * sgnPow(Math.sin(v), e2)];
  const local = (u: number, v: number): V3 => {
    const [x, y, z] = unit(u, v), k = lerp(t0, t1, (y + 1) / 2);
    return [x * rx * k + hx * y * ry, y * ry, z * rz * k + hz * y * ry];
  };
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const grid: number[][] = [];
  for (let i = 0; i <= rings; i++) {
    const u = -Math.PI / 2 + Math.PI * i / rings, row: number[] = [];
    for (let j = 0; j < seg; j++) {
      const v = -Math.PI + 2 * Math.PI * j / seg, p = local(u, v);
      // Normals: the cross product of the surface's tangents, taken just inside the poles so it never degenerates.
      const uu = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, u)), eps = 1e-3;
      const du = sub(local(uu + eps, v), local(uu - eps, v)), dv = sub(local(uu, v + eps), local(uu, v - eps));
      let n = normalize(cross(dv, du));
      const outward = sub(local(uu, v), [hx * Math.sin(uu) * ry, 0, hz * Math.sin(uu) * ry]);
      if (dot(n, outward) < 0) n = [-n[0], -n[1], -n[2]];
      row.push(positions.length / 3);
      positions.push(...apply(m, p)); normals.push(...normalize(applyDir(m, n)));
    }
    grid.push(row);
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = grid[i][j], b = grid[i][(j + 1) % seg], c = grid[i + 1][(j + 1) % seg], d = grid[i + 1][j];
    for (const tri of [[a, b, c], [a, c, d]]) {
      if (o.keep) {
        const u = -Math.PI / 2 + Math.PI * (i + 0.5) / rings, v = -Math.PI + 2 * Math.PI * (j + 0.5) / seg, [x, y, z] = unit(u, v);
        if (!o.keep(x, y, z)) continue;
      }
      indices.push(...tri);
    }
  }
  return { positions, normals, indices };
}
/** A key of a limb's profile: at height `y` on its axis, its half-widths across (x) and front to back (z), and how far
 * its centre sits off the axis (`dx`, `dz`): a deltoid out, a biceps forward, a calf back. */
export interface Ring { y: number; rx: number; rz: number; dx?: number; dz?: number }
export interface Limb {
  /** The profile's keys, top to bottom; a smooth curve runs through them (no overshoot, so no beads). */
  rings: Ring[];
  /** The cross-section's roundness: 1 an ellipse, below 1 squarer (a torso), 2 a diamond. */
  e?: number;
  /** How far the top and bottom round out past their end keys (m); 0 leaves that end open. */
  caps?: [number, number];
  /** How round each cap is: 1 a dome (default), 0 a cone (the trapezius's slope from the neck to the shoulder). */
  round?: [number, number];
  /** Keep only the stretch between these heights (high, low): one material's share of a limb, open where it is cut, so
   * the stretches of one limb meet ring to ring. */
  span?: [number, number];
  /** Around the axis, and the spacing of rings along it (m). */
  seg?: number; step?: number;
}
/** A monotone cubic through (x, y) keys (Fritsch–Carlson): smooth, and never past its keys. */
function curve(xs: number[], ys: number[]) {
  const n = xs.length, d: number[] = [], m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i] || 1e-9));
  if (n > 1) { m[0] = d[0]; m[n - 1] = d[n - 2]; }
  // A key between a rise and a fall is a flat top; elsewhere the slopes' weighted harmonic mean.
  for (let i = 1; i < n - 1; i++) if (d[i - 1] * d[i] > 0) { const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]), w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]); m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
/**
 * A limb: a tube swept down its axis (y) whose cross-section follows a profile, with rounded ends. One profile from the
 * shoulder to the wrist (or the hip to the ankle) makes a deltoid, a biceps, an elbow, a forearm and a wrist as one form,
 * never stacked boxes; skinned across its joints it bends without a bulge (the smooth union a sculpt has).
 */
export function limb(o: Limb): Mesh {
  const keys = [...o.rings].sort((a, b) => a.y - b.y), ys = keys.map(r => r.y), e = o.e ?? 1, seg = o.seg ?? 16, step = o.step ?? 0.012;
  const RX = curve(ys, keys.map(r => r.rx)), RZ = curve(ys, keys.map(r => r.rz)), DX = curve(ys, keys.map(r => r.dx ?? 0)), DZ = curve(ys, keys.map(r => r.dz ?? 0));
  const yLo = ys[0], yHi = ys[ys.length - 1], [capHi, capLo] = o.caps ?? [0, 0], [roundHi, roundLo] = o.round ?? [1, 1];
  const capScale = (a: number, round: number) => lerp(1 - Math.sin(a), Math.cos(a) ** 0.8, round);
  const top = Math.min(yHi, o.span?.[0] ?? Infinity), bottom = Math.max(yLo, o.span?.[1] ?? -Infinity);
  const hiCap = top >= yHi - 1e-9 ? capHi : 0, loCap = bottom <= yLo + 1e-9 ? capLo : 0;
  // One parameter s down the whole length: the top cap, the body, the bottom cap. A cap is a quarter ellipse of its end
  // ring, so the form closes round, as a joint's end does.
  const capRings = (c: number) => (c > 0 ? 5 : 0), body = Math.max(2, Math.ceil((top - bottom) / step));
  const nHi = capRings(hiCap), nLo = capRings(loCap), rings = nHi + body + nLo;
  const at = (s: number, v: number): V3 => {
    let y: number, k = 1, ry: number;
    if (s < nHi) { const a = (Math.PI / 2) * (1 - s / nHi); ry = top; y = top + hiCap * Math.sin(a); k = capScale(a, roundHi); }
    else if (s > nHi + body) { const a = (Math.PI / 2) * ((s - nHi - body) / nLo); ry = bottom; y = bottom - loCap * Math.sin(a); k = capScale(a, roundLo); }
    else { y = top - (top - bottom) * (s - nHi) / body; ry = y; }
    const c = Math.cos(v), sn = Math.sin(v);
    return [DX(ry) + sgnPow(c, e) * RX(ry) * k, y, DZ(ry) + sgnPow(sn, e) * RZ(ry) * k];
  };
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (let i = 0; i <= rings; i++) for (let j = 0; j < seg; j++) {
    const v = -Math.PI + 2 * Math.PI * j / seg, p = at(i, v), eps = 1e-3;
    // Normals: the surface's own tangents, taken just off the poles so they never degenerate.
    const si = Math.max(0.02, Math.min(rings - 0.02, i));
    const ds = sub(at(Math.min(rings, si + 0.02), v), at(Math.max(0, si - 0.02), v)), dv = sub(at(si, v + eps), at(si, v - eps));
    let n = normalize(cross(dv, ds));
    const q = at(si, v), centre: V3 = [DX(Math.max(bottom, Math.min(top, q[1]))), q[1], DZ(Math.max(bottom, Math.min(top, q[1])))];
    const out = sub(q, centre);
    if (i <= 0 && hiCap > 0) n = [0, 1, 0]; else if (i >= rings && loCap > 0) n = [0, -1, 0];
    else if (dot(n, out) < 0) n = [-n[0], -n[1], -n[2]];
    positions.push(...p); normals.push(...n);
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + (j + 1) % seg, d = (i + 1) * seg + j;
    indices.push(a, b, c, a, c, d);
  }
  return { positions, normals, indices };
}
/** Skin weights from a function of each rest position. */
export function weights(mesh: Mesh, f: (x: number, y: number, z: number) => [number, number][]): [number, number][][] {
  const out: [number, number][][] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) out.push(f(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]));
  return out;
}
/**
 * How far out from `origin` along the unit `dir` the outermost surface of `parts` lies at rest (rest figure space), or 0:
 * where a hand rests on the cloth. Skinned parts are authored in rest figure space, rigid ones in their bone's (rest
 * rotations are the identity, so at `rest[bone]`).
 */
export function reach(parts: Part[], rest: V3[], origin: V3, dir: V3): number {
  let far = 0;
  for (const p of parts) {
    const P = p.mesh.positions, I = p.mesh.indices, o = sub(p.bone === undefined ? [0, 0, 0] : rest[p.bone], origin);
    const at = (i: number): V3 => [P[i * 3] + o[0], P[i * 3 + 1] + o[1], P[i * 3 + 2] + o[2]];
    for (let i = 0; i < I.length; i += 3) {
      // Möller–Trumbore, the ray from the origin.
      const a = at(I[i]), e1 = sub(at(I[i + 1]), a), e2 = sub(at(I[i + 2]), a), q = cross(dir, e2), det = dot(e1, q);
      if (Math.abs(det) < 1e-12) continue;
      const t0 = scale(a, -1), u = dot(t0, q) / det, r = cross(t0, e1), v = dot(dir, r) / det;
      if (u < 0 || v < 0 || u + v > 1) continue;
      far = Math.max(far, dot(e2, r) / det);
    }
  }
  return far;
}
/**
 * Each bone's surface group: the group most of the vertices it carries belong to (a rigid part's all, a skinned vertex's
 * by weight), so a mark on the thigh knows the leg is its surface and a hand lying over it is not. `skip` groups
 * (jewellery) carry no marks of their own.
 */
export function boneGroups(parts: Part[], skip: number[] = []): Map<number, number> {
  const votes = new Map<number, Map<number, number>>();
  const vote = (bone: number, group: number, n: number) => {
    const v = votes.get(bone) ?? new Map<number, number>(); v.set(group, (v.get(group) ?? 0) + n); votes.set(bone, v);
  };
  for (const p of parts) {
    if (skip.includes(p.group)) continue;
    if (p.bone !== undefined) vote(p.bone, p.group, p.mesh.positions.length / 3);
    else for (const w of p.skin ?? []) for (const [bone, weight] of w) vote(bone, p.group, weight);
  }
  return new Map([...votes].map(([bone, v]) => [bone, [...v].reduce((a, b) => (b[1] > a[1] ? b : a))[0]]));
}
/** Moves a mesh (a part authored around the origin) by a turn and an offset. */
export function placed(mesh: Mesh, at: V3, turn: Q = IDENTITY_Q): Mesh {
  const m = compose(turn, at);
  const positions: number[] = [], normals: number[] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    positions.push(...apply(m, [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]]));
    normals.push(...applyDir(m, [mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]]));
  }
  return { positions, normals, indices: mesh.indices.slice() };
}
