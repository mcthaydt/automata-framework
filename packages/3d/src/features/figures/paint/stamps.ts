import { hypot } from '@automata/sim/math'
import type { GBuffer } from './raster.ts'
/**
 * A decal in view space: texel position, depth, normal z (how much it faces the camera), material, size in texels, and
 * the surface group it lies on (parts.ts boneGroups), when known.
 */
export interface ViewDecal {
  x: number
  y: number
  z: number
  facing: number
  material: number
  w: number
  h: number
  group?: number
  print?: ViewPrint
}
/** A print in view space (parts.ts Print): its bitmap, a bitmap texel's step across and down (cell texels x, y and depth
 * in metres), its surface's seams (none: it lies over anything), and its texels' materials by character. */
export interface ViewPrint {
  rows: string[]
  du: [number, number, number]
  dv: [number, number, number]
  seams?: number[]
  inks: Record<string, number>
}
/**
 * Marks (eyes, buttons) on the surface: only where they face the camera and the surface there is theirs: its own group
 * (so a hand resting on a pocket hides the pocket's stitch) or one lying `over` any (jewellery, which bears its own
 * glints), and the visible surface: no nearer than the mark by more than a texel and a little (`texel`, m), more as the
 * surface turns away (its depth runs faster across a texel). A mark more than half hidden is not drawn at all, so a heel
 * tab under a hem vanishes rather than leaving a fleck on the hem's edge.
 */
export function stamp(decals: ViewDecal[], g: GBuffer, texel = 0.027, over: number[] = []): void {
  const ks: number[] = []
  for (const d of decals) {
    if (d.facing < 0.3) continue
    const x0 = Math.floor(d.x - d.w / 2 + 0.5),
      y0 = Math.floor(d.y - d.h / 2 + 0.5),
      slack = (1.2 * texel) / Math.max(0.35, d.facing)
    ks.length = 0
    for (let y = y0; y < y0 + d.h; y++)
      for (let x = x0; x < x0 + d.w; x++) {
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue
        const k = y * g.w + x
        if ((g.material[k] ?? Number.NaN) < 0 || (g.depth[k] ?? Number.NaN) > d.z + slack) continue
        if (
          d.group !== undefined &&
          (g.group[k] ?? Number.NaN) !== d.group &&
          !over.includes(g.group[k] ?? Number.NaN)
        )
          continue
        ks.push(k)
      }
    if (2 * ks.length < d.w * d.h) continue
    for (const k of ks) {
      g.material[k] = d.material
      g.part[k] = -2
    }
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
export function stampPrint(d: ViewDecal, g: GBuffer, facing = 0.42, turn = 0.6): void {
  const p = d.print!
  if (d.facing < facing) return
  const su = hypot(p.du[0], p.du[1]),
    sv = hypot(p.dv[0], p.dv[1])
  if (su < turn || sv < turn) return
  const W = Math.max(...p.rows.map((r) => r.length)),
    dir = Math.sign(p.du[0]) || 1,
    shear = p.dv[0] / sv,
    close = Math.max(0, Math.round(W * (1 - su)))
  const x0 = Math.floor(d.x),
    y0 = Math.floor(d.y),
    put: [number, number][] = [],
    inked = (c?: string) => !!c && c !== '.' && c !== ','
  let off = 0,
    ink = 0,
    line = 0
  p.rows.forEach((row, j) => {
    if (![...(p.rows[j - 1] ?? '')].some(inked)) line = j
    // A gap's columns past its first may close, those nearest the row's middle first, so the line keeps its centre.
    const gaps = [...row]
      .map((c, i) => (c === ',' && (row[i - 1] ?? '') === ',' ? i : -1))
      .filter((i) => i >= 0)
      .sort((a, b) => Math.abs(a - (W - 1) / 2) - Math.abs(b - (W - 1) / 2))
      .slice(0, close)
    const kept = [...row].map((c, i) => [c, i] as const).filter(([, i]) => !gaps.includes(i)),
      mid = Math.floor((kept.length - 1) / 2)
    kept.forEach(([c, i], col) => {
      const material = p.inks[c] ?? Number.NaN
      if (!inked(c) || material === undefined) return
      const x = x0 + dir * (col - mid) + Math.round(line * shear),
        y = y0 + j
      ink++
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) {
        off++
        return
      }
      const k = y * g.w + x,
        z = d.z + p.du[2] * (i - (W - 1) / 2) + p.dv[2] * j
      if (!p.seams) {
        if ((g.material[k] ?? Number.NaN) >= 0 && (g.depth[k] ?? Number.NaN) < z + 0.02)
          put.push([k, material])
        return
      }
      // Off the cloth: nothing there, or only what lies well behind it (the far arm, the legs).
      const on = p.seams.includes(g.part[k] ?? Number.NaN)
      if ((g.material[k] ?? Number.NaN) < 0 || (!on && (g.depth[k] ?? Number.NaN) < z - 0.05)) {
        off++
        return
      }
      if (on) put.push([k, material])
    })
  })
  if (p.seams && off > 0.05 * ink) return
  for (const [k, m] of put) {
    g.material[k] = m
    g.part[k] = -2
  }
}
