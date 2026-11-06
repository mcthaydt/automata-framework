import { GROUP } from '../body/parts';
/**
 * The figure's own small render target. A CPU rasteriser draws the posed parts `supersample` times larger than the cell
 * into a G-buffer (depth, part, material, group, normal, and the surface's own place); `resolve` gives each texel the
 * part that owns it (the nearest that covers enough of it, else the largest), so every texel is one clean cluster of one
 * part, never a sliver; `cleanup` removes the orphans, spurs and pinholes pixel artists remove by hand, and `blendJoins`
 * and `smoothContour` join the parts of one surface and soften the contour. The decal stamps then put the marks (the
 * face's, a hand's) on the surface by the part they sit on, and `noise3` is the surface's own noise. The painter
 * (paint.ts) paints the result.
 *
 * View space: x right, y up, z toward the camera.
 */
/** The rasteriser's own knobs. */
export interface Style {
  /** Subsamples per texel along each axis. */
  supersample: number;
  /** A part keeps a texel if it is the nearest part there and covers at least this share of it. */
  priority: number;
  /** A texel is filled when the figure covers at least this share of it. */
  coverage: number;
  /** Remove orphan texels, single-texel spurs and pinholes. */
  cleanup: boolean;
}
export const STYLE: Style = { supersample: 3, priority: 0.3, coverage: 0.45, cleanup: true };
/** Ints per triangle in a soup, and floats per vertex (texel x, y, depth, normal, surface place). */
export const TRI = 6, VERT = 9;
/** A triangle soup in view space, in texels (x right, y down) with depth in metres toward the camera. */
export interface Soup {
  /** Per vertex: texel x, texel y, depth, normal x, y, z, and the surface's own place (rest position) x, y, z. */
  verts: Float32Array; count: number;
  /** Per triangle: three vertex indices, then the material, group and part. */
  tris: Int32Array; triCount: number;
}
export interface GBuffer {
  w: number; h: number;
  depth: Float32Array; material: Int16Array; group: Int16Array; part: Int16Array; normal: Float32Array;
  /** The surface's rest position at each texel: where its grain is looked up. */
  place: Float32Array;
}
export function gbuffer(w: number, h: number): GBuffer {
  return { w, h, depth: new Float32Array(w * h), material: new Int16Array(w * h), group: new Int16Array(w * h), part: new Int16Array(w * h), normal: new Float32Array(w * h * 3), place: new Float32Array(w * h * 3) };
}
/** Cloth that hangs over the legs (the trunk's and a skirt's: +1) and the legs (−1): see `rasterize`'s `over`. */
const LAYER = new Int8Array(16);
LAYER[GROUP.torso] = LAYER[GROUP.skirt] = 1; LAYER[GROUP.legL] = LAYER[GROUP.legR] = -1;
/**
 * Z-buffered, point-sampled at sample centres. Larger depth is nearer. Edge functions step incrementally along each row.
 * Cloth over the legs wins a tie with a leg of another material within `over` (m), the most a stride's thigh runs ahead
 * of a hem that follows it late, so the leg never shows through a top's or a skirt's hem.
 */
export function rasterize(soup: Soup, g: GBuffer, over = 0.1) {
  const { w, h, depth, material, group, part, normal, place } = g, v = soup.verts;
  depth.fill(-Infinity); material.fill(-1); group.fill(-1); part.fill(-1);
  for (let t = 0; t < soup.triCount; t++) {
    const T = t * TRI, i0 = soup.tris[T] * VERT, i1 = soup.tris[T + 1] * VERT, i2 = soup.tris[T + 2] * VERT, mat = soup.tris[T + 3], grp = soup.tris[T + 4], prt = soup.tris[T + 5];
    const x0 = v[i0], y0 = v[i0 + 1], x1 = v[i1], y1 = v[i1 + 1], x2 = v[i2], y2 = v[i2 + 1];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) continue;
    // Barycentrics a, b at a sample centre are linear in x and y: their per-texel steps.
    const inv = 1 / area, adx = (y1 - y2) * inv, bdx = (y2 - y0) * inv;
    const z0 = v[i0 + 2], z1 = v[i1 + 2], z2 = v[i2 + 2];
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5, px = minX + 0.5;
      let a = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv, b = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv;
      for (let x = minX; x <= maxX; x++, a += adx, b += bdx) {
        const c = 1 - a - b;
        if (a < -1e-7 || b < -1e-7 || c < -1e-7) continue;
        const z = a * z0 + b * z1 + c * z2, k = y * w + x, layer = LAYER[grp];
        if (z + (layer && group[k] >= 0 && LAYER[group[k]] === -layer && material[k] !== mat ? layer * over : 0) <= depth[k]) continue;
        depth[k] = z; material[k] = mat; group[k] = grp; part[k] = prt;
        const k3 = k * 3;
        normal[k3] = a * v[i0 + 3] + b * v[i1 + 3] + c * v[i2 + 3]; normal[k3 + 1] = a * v[i0 + 4] + b * v[i1 + 4] + c * v[i2 + 4]; normal[k3 + 2] = a * v[i0 + 5] + b * v[i1 + 5] + c * v[i2 + 5];
        place[k3] = a * v[i0 + 6] + b * v[i1 + 6] + c * v[i2 + 6]; place[k3 + 1] = a * v[i0 + 7] + b * v[i1 + 7] + c * v[i2 + 7]; place[k3 + 2] = a * v[i0 + 8] + b * v[i1 + 8] + c * v[i2 + 8];
      }
    }
  }
}
/**
 * Supersampled G-buffer → cell G-buffer. A texel is filled where the figure covers `coverage` of it; it belongs to the
 * nearest part covering `priority` of it (so a thin arm in front of the body stays whole), else to the part covering
 * most. Its normal is that part's mean normal there, its depth that part's nearest.
 */
export function resolve(hi: GBuffer, lo: GBuffer, s: number, style: Style = STYLE) {
  // Scratch per texel, at most s² candidate parts: their ids, sample counts, nearest depth and its sample, and sums.
  const n = s * s, ids = new Int32Array(n), counts = new Int32Array(n), nearest = new Float64Array(n), firstAt = new Int32Array(n), sums = new Float64Array(n * 6);
  lo.depth.fill(-Infinity); lo.material.fill(-1); lo.group.fill(-1); lo.part.fill(-1);
  for (let y = 0; y < lo.h; y++) for (let x = 0; x < lo.w; x++) {
    let m = 0, filled = 0;
    for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) {
      const k = (y * s + sy) * hi.w + x * s + sx, p = hi.part[k];
      if (p < 0) continue;
      filled++;
      let i = 0;
      while (i < m && ids[i] !== p) i++;
      if (i === m) { ids[i] = p; counts[i] = 0; nearest[i] = -Infinity; firstAt[i] = k; sums.fill(0, i * 6, i * 6 + 6); m++; }
      counts[i]++;
      if (hi.depth[k] > nearest[i]) { nearest[i] = hi.depth[k]; firstAt[i] = k; }
      const k3 = k * 3, o6 = i * 6;
      sums[o6] += hi.normal[k3]; sums[o6 + 1] += hi.normal[k3 + 1]; sums[o6 + 2] += hi.normal[k3 + 2];
      sums[o6 + 3] += hi.place[k3]; sums[o6 + 4] += hi.place[k3 + 1]; sums[o6 + 5] += hi.place[k3 + 2];
    }
    if (filled < n * style.coverage) continue;
    let pick = 0, front = -1;
    for (let i = 1; i < m; i++) if (counts[i] > counts[pick]) pick = i;
    for (let i = 0; i < m; i++) if (counts[i] >= n * style.priority && (front < 0 || nearest[i] > nearest[front])) front = i;
    if (front >= 0) pick = front;
    const o = y * lo.w + x, o6 = pick * 6, c = counts[pick], k = firstAt[pick];
    const l = Math.hypot(sums[o6], sums[o6 + 1], sums[o6 + 2]) || 1;
    lo.part[o] = ids[pick]; lo.material[o] = hi.material[k]; lo.group[o] = hi.group[k]; lo.depth[o] = nearest[pick];
    lo.normal[o * 3] = sums[o6] / l; lo.normal[o * 3 + 1] = sums[o6 + 1] / l; lo.normal[o * 3 + 2] = sums[o6 + 2] / l;
    lo.place[o * 3] = sums[o6 + 3] / c; lo.place[o * 3 + 1] = sums[o6 + 4] / c; lo.place[o * 3 + 2] = sums[o6 + 5] / c;
  }
}
const copyTexel = (g: GBuffer, to: number, from: number) => {
  for (let i = 0; i < 3; i++) g.place[to * 3 + i] = g.place[from * 3 + i];
  g.part[to] = g.part[from]; g.material[to] = g.material[from]; g.group[to] = g.group[from]; g.depth[to] = g.depth[from];
  g.normal[to * 3] = g.normal[from * 3]; g.normal[to * 3 + 1] = g.normal[from * 3 + 1]; g.normal[to * 3 + 2] = g.normal[from * 3 + 2];
};
/** The hand pass: an orphan texel (no 4-neighbour of its part) joins its neighbours' part; a spur (one filled
 * neighbour) is removed; a pinhole (three or four filled neighbours) is filled. */
export function cleanup(g: GBuffer) {
  // The same rules as written out with arrays, without allocating per texel (it runs on every raster).
  const { w, h, part } = g, kill: number[] = [], fill: number[] = [], join: number[] = [];
  const nb = new Int32Array(4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    let n = 0;
    if (x > 0 && part[k - 1] >= 0) nb[n++] = k - 1;
    if (x < w - 1 && part[k + 1] >= 0) nb[n++] = k + 1;
    if (y > 0 && part[k - w] >= 0) nb[n++] = k - w;
    if (y < h - 1 && part[k + w] >= 0) nb[n++] = k + w;
    if (part[k] < 0) {
      if (n >= 3) { let best = nb[0]; for (let i = 1; i < n; i++) if (g.depth[nb[i]] > g.depth[best]) best = nb[i]; fill.push(k, best); }
      continue;
    }
    if (n <= 1) { kill.push(k); continue; }
    if (n === 4 && part[nb[0]] !== part[k] && part[nb[1]] !== part[k] && part[nb[2]] !== part[k] && part[nb[3]] !== part[k]) {
      // The neighbours' commonest part takes the orphan (the first of the commonest, in neighbour order).
      let bestPart = -1, bestCount = 0;
      for (let i = 0; i < 4; i++) {
        const p = part[nb[i]];
        let c = 0; for (let j = 0; j < 4; j++) if (part[nb[j]] === p) c++;
        if (c > bestCount) { bestCount = c; bestPart = p; }
      }
      if (bestCount >= 2) for (let i = 0; i < 4; i++) if (part[nb[i]] === bestPart) { join.push(k, nb[i]); break; }
    }
  }
  for (const k of kill) { part[k] = -1; g.material[k] = -1; g.group[k] = -1; g.depth[k] = -Infinity; }
  for (let i = 0; i < fill.length; i += 2) copyTexel(g, fill[i], fill[i + 1]);
  for (let i = 0; i < join.length; i += 2) copyTexel(g, join[i], join[i + 1]);
}
/**
 * The neckline, as a pixel artist cleans a collar: where the neck meets a top, a run of the neck's texels in a row, at most
 * `min(2D, 4)` long (D the cell's density; the cap of 4 keeps the round bottom of the neck's U at D4), with one non-neck
 * material on its left, its right and under every texel of it, is a skin tooth in the cloth; it joins that material, each
 * texel taking its nearer side's neighbour (the left half the left's, the right half the right's). The bottom row first, so a peg two rows tall goes too. `neck` holds the G-buffer's part ids
 * of the neck (the parts tagged NECK); nothing else is touched: not a hand, not a finger, not the hair.
 */
export function neckline(g: GBuffer, neck: Set<number>) {
  const { w, h, part, material } = g, D = Math.max(1, Math.round(w / 64)), isNeck = (k: number) => neck.has(part[k]);
  for (let y = h - 2; y >= 1; y--) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x;
    if (!isNeck(k) || isNeck(k - 1)) continue;
    let n = 0; while (x + n < w - 1 && isNeck(k + n)) n++;
    const l = k - 1, r = k + n, m = material[l];
    const cloth = (q: number) => part[q] >= 0 && !neck.has(part[q]) && material[q] === m;
    let tooth = n <= Math.min(2 * D, 4) && cloth(l) && cloth(r);
    for (let i = 0; tooth && i < n; i++) tooth = cloth(k + i + w);
    if (tooth) for (let i = 0; i < n; i++) copyTexel(g, k + i, i < n / 2 ? l : r);
    x += n - 1;
  }
}
/**
 * Joins, as a smooth union would make them (screen-space): an empty texel pinched between two texels of one group (left
 * and right, or above and below) at nearly the same depth is the notch where two rounded parts meet; it takes the nearer
 * side. Two groups (the legs, an arm against the body) never join.
 */
export function blendJoins(g: GBuffer, within = 0.06) {
  const { w, h, part, group, depth } = g, fill: number[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x;
    if (part[k] >= 0) continue;
    for (const [a, b] of [[k - 1, k + 1], [k - w, k + w]]) {
      if (part[a] < 0 || part[b] < 0 || group[a] !== group[b] || Math.abs(depth[a] - depth[b]) > within) continue;
      fill.push(k, depth[a] >= depth[b] ? a : b); break;
    }
  }
  for (let i = 0; i < fill.length; i += 2) copyTexel(g, fill[i], fill[i + 1]);
}
/**
 * The contour as a pixel artist draws a long edge: its steps change length monotonically, so a bump or a dent of a texel
 * on a near-straight edge (a run of up to `3D` stepping out of line and back, with half as much again in line either
 * side, on one form: its group, or one cloth across groups, whichever parts meet along it, so a sleeve's step onto its
 * cuff or a trouser's from seat to leg is cleared too) is cleared or filled to the line. Faces and hair (the head
 * group) keep their drawn edge.
 */
export function smoothContour(g: GBuffer) {
  const { w, h, part, group, material } = g, D = Math.max(1, Math.round(w / 64));
  // Each side in turn as the left edge: u runs along it, v across it, outward toward v − 1.
  for (let o = 0; o < 4; o++) {
    const U = o < 2 ? h : w, V = o < 2 ? w : h;
    const at = (u: number, v: number) => (o < 2 ? u * w + (o === 0 ? v : w - 1 - v) : (o === 2 ? v : h - 1 - v) * w + u);
    const on = (u: number, v: number) => u >= 0 && v >= 0 && u < U && v < V && part[at(u, v)] >= 0;
    const edge = (u: number, v: number) => on(u, v) && !on(u, v - 1);
    const clear: number[] = [], fill: number[] = [];
    for (let v = 1; v < V - 1; v++) for (let u = 1; u < U; u++) {
      if (!edge(u, v) || edge(u - 1, v)) continue;
      let L = 0; while (L <= 3 * D && edge(u + L, v)) L++;
      if (L > 3 * D) continue;
      const F = Math.max(2, Math.ceil(1.5 * L));
      const k0 = at(u, v), g0 = group[k0], m0 = material[k0];
      if (g0 === GROUP.head) continue;
      /** One form with the run's: its group, or its cloth on another group (never the head's). */
      const one = (k: number) => group[k] !== GROUP.head && (group[k] === g0 || material[k] === m0);
      const flank = (dv: number) => {
        for (let i = 1; i <= F; i++) if (!edge(u - i, v + dv) || !one(at(u - i, v + dv))) return false;
        for (let i = 0; i < F; i++) if (!edge(u + L + i, v + dv) || !one(at(u + L + i, v + dv))) return false;
        return true;
      };
      if (flank(1)) { let inside = true; for (let i = 0; i < L; i++) inside &&= on(u + i, v + 1) && one(at(u + i, v + 1)); if (inside) for (let i = 0; i < L; i++) clear.push(at(u + i, v)); }
      else if (flank(-1)) for (let i = 0; i < L; i++) fill.push(at(u + i, v - 1), at(u + i, v));
    }
    for (const k of clear) { part[k] = -1; g.material[k] = -1; g.group[k] = -1; g.depth[k] = -Infinity; }
    for (let i = 0; i < fill.length; i += 2) copyTexel(g, fill[i], fill[i + 1]);
  }
}
/**
 * A decal in view space: texel position, depth, normal z (how much it faces the camera), material, size in texels, and
 * the surface group it lies on (parts.ts boneGroups), when known.
 */
export interface ViewDecal { x: number; y: number; z: number; facing: number; material: number; w: number; h: number; group?: number; print?: ViewPrint }
/** A print in view space (parts.ts Print): its bitmap, a bitmap texel's step across and down (cell texels x, y and depth
 * in metres), its surface's seams (none: it lies over anything), and its texels' materials by character. */
export interface ViewPrint { rows: string[]; du: [number, number, number]; dv: [number, number, number]; seams?: number[]; inks: Record<string, number> }
/**
 * Marks (eyes, buttons) on the surface: only where they face the camera and the surface there is theirs: its own group
 * (so a hand resting on a pocket hides the pocket's stitch) or one lying `over` any (jewellery, which bears its own
 * glints), and the visible surface: no nearer than the mark by more than a texel and a little (`texel`, m), more as the
 * surface turns away (its depth runs faster across a texel). A mark more than half hidden is not drawn at all, so a heel
 * tab under a hem vanishes rather than leaving a fleck on the hem's edge.
 */
export function stamp(decals: ViewDecal[], g: GBuffer, texel = 0.027, over: number[] = []) {
  const ks: number[] = [];
  for (const d of decals) {
    if (d.facing < 0.3) continue;
    const x0 = Math.floor(d.x - d.w / 2 + 0.5), y0 = Math.floor(d.y - d.h / 2 + 0.5), slack = (1.2 * texel) / Math.max(0.35, d.facing);
    ks.length = 0;
    for (let y = y0; y < y0 + d.h; y++) for (let x = x0; x < x0 + d.w; x++) {
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      const k = y * g.w + x;
      if (g.material[k] < 0 || g.depth[k] > d.z + slack) continue;
      if (d.group !== undefined && g.group[k] !== d.group && !over.includes(g.group[k])) continue;
      ks.push(k);
    }
    if (2 * ks.length < d.w * d.h) continue;
    for (const k of ks) { g.material[k] = d.material; g.part[k] = -2; }
  }
}
/**
 * A print stamped flat in the cell, as a pixel artist letters a garment: the bitmap texel for texel on the integer
 * grid from its projected anchor (its top's centre), never resampled, so no letter drops or doubles a column; as the
 * cloth leans, each line of it shifts by whole texels (a line's letters stay together). As the cloth turns from the
 * camera, gaps between its letters wider than a texel (',') close toward the width the cloth shows, never to nothing;
 * past where it stays legible (the cloth turned under `turn` across, or facing under `facing`) it is not drawn at all.
 * Printed on a surface (`seams`), its texels land only on that surface's visible texels, so an arm, a hood or hair in
 * front hides it as it does the cloth, and where it would run off the cloth's silhouette it is not drawn; with none (a
 * pendant hanging on the chest), it lies over whatever is behind it, hidden only by what passes in front.
 */
export function stampPrint(d: ViewDecal, g: GBuffer, facing = 0.42, turn = 0.6) {
  const p = d.print!; if (d.facing < facing) return;
  const su = Math.hypot(p.du[0], p.du[1]), sv = Math.hypot(p.dv[0], p.dv[1]); if (su < turn || sv < turn) return;
  const W = Math.max(...p.rows.map(r => r.length)), dir = Math.sign(p.du[0]) || 1, shear = p.dv[0] / sv, close = Math.max(0, Math.round(W * (1 - su)));
  const x0 = Math.floor(d.x), y0 = Math.floor(d.y), put: [number, number][] = [], inked = (c?: string) => !!c && c !== '.' && c !== ',';
  let off = 0, ink = 0, line = 0;
  p.rows.forEach((row, j) => {
    if (![...(p.rows[j - 1] ?? '')].some(inked)) line = j;
    // A gap's columns past its first may close, those nearest the row's middle first, so the line keeps its centre.
    const gaps = [...row].map((c, i) => (c === ',' && row[i - 1] === ',' ? i : -1)).filter(i => i >= 0).sort((a, b) => Math.abs(a - (W - 1) / 2) - Math.abs(b - (W - 1) / 2)).slice(0, close);
    const kept = [...row].map((c, i) => [c, i] as const).filter(([, i]) => !gaps.includes(i)), mid = Math.floor((kept.length - 1) / 2);
    kept.forEach(([c, i], col) => {
      const material = p.inks[c]; if (!inked(c) || material === undefined) return;
      const x = x0 + dir * (col - mid) + Math.round(line * shear), y = y0 + j;
      ink++;
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) { off++; return; }
      const k = y * g.w + x, z = d.z + p.du[2] * (i - (W - 1) / 2) + p.dv[2] * j;
      if (!p.seams) { if (g.material[k] >= 0 && g.depth[k] < z + 0.02) put.push([k, material]); return; }
      // Off the cloth: nothing there, or only what lies well behind it (the far arm, the legs).
      const on = p.seams.includes(g.part[k]);
      if (g.material[k] < 0 || (!on && g.depth[k] < z - 0.05)) { off++; return; }
      if (on) put.push([k, material]);
    });
  });
  if (p.seams && off > 0.05 * ink) return;
  for (const [k, m] of put) { g.material[k] = m; g.part[k] = -2; }
}
/** Smooth 3D value noise in [0, 1), deterministic. */
const lattice = (x: number, y: number, z: number) => { let n = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1); n = Math.imul(n ^ (n >>> 15), 0x85ebca6b); n ^= n >>> 13; return (n >>> 0) / 4294967296; };
export function noise3(x: number, y: number, z: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), fx = x - x0, fy = y - y0, fz = z - z0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const at = (i: number, j: number, k: number) => lattice(x0 + i, y0 + j, z0 + k);
  const x00 = at(0, 0, 0) + (at(1, 0, 0) - at(0, 0, 0)) * u, x10 = at(0, 1, 0) + (at(1, 1, 0) - at(0, 1, 0)) * u;
  const x01 = at(0, 0, 1) + (at(1, 0, 1) - at(0, 0, 1)) * u, x11 = at(0, 1, 1) + (at(1, 1, 1) - at(0, 1, 1)) * u;
  const y0v = x00 + (x10 - x00) * v, y1v = x01 + (x11 - x01) * v;
  return y0v + (y1v - y0v) * w;
}
