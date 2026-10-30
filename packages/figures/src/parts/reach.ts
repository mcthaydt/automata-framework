// How far out a dressed figure's surface lies along a ray: where a hand rests on the cloth, how far a hair tail
// falls clear of the back, how far an arm hangs out to clear the body.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/parts.ts at a1f7246 (`reach`), with
// AF's strict types; the formula and its order are the source's.

import { cross, dot, scale, sub, type V3 } from '../math/math'
import { at } from '../rig/rig'
import { type Part, vertexAt } from './mesh'

/**
 * How far out from `origin` along the unit `dir` the outermost surface of `parts` lies at rest (rest figure space), or 0.
 * Skinned parts are authored in rest figure space, rigid ones in their bone's (rest rotations are the identity, so at
 * `rest[bone]`).
 */
export function reach(parts: readonly Part[], rest: readonly V3[], origin: V3, dir: V3): number {
  let far = 0
  for (const p of parts) {
    const P = p.mesh.positions
    const I = p.mesh.indices
    const o = sub(p.bone === undefined ? [0, 0, 0] : at(rest, p.bone), origin)
    const point = (i: number): V3 => {
      const v = vertexAt(P, i)
      return [v[0] + o[0], v[1] + o[1], v[2] + o[2]]
    }
    for (let i = 0; i < I.length; i += 3) {
      // Möller–Trumbore, the ray from the origin.
      const a = point(at(I, i))
      const e1 = sub(point(at(I, i + 1)), a)
      const e2 = sub(point(at(I, i + 2)), a)
      const q = cross(dir, e2)
      const det = dot(e1, q)
      if (Math.abs(det) < 1e-12) continue
      const t0 = scale(a, -1)
      const u = dot(t0, q) / det
      const r = cross(t0, e1)
      const v = dot(dir, r) / det
      if (u < 0 || v < 0 || u + v > 1) continue
      far = Math.max(far, dot(e2, r) / det)
    }
  }
  return far
}
