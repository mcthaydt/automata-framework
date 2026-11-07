// How far out a dressed figure's surface lies along a ray: where a hand rests on the cloth, how far a hair tail falls
// clear of the back, how far an arm hangs out to clear the body.

import type { V3 } from '../../../shared/math/math.ts'
import type { Part } from './mesh.ts'
import { at } from './rig.ts'

/**
 * How far out from `origin` along the unit `dir` the outermost surface of `parts` lies at rest (rest figure
 * space), or 0. Skinned parts are authored in rest figure space, rigid ones in their bone's (rest rotations
 * are the identity, so at `rest[bone]`).
 */
export function reach(parts: readonly Part[], rest: readonly V3[], origin: V3, dir: V3): number {
  // Scalar arithmetic in the source's order (sub, cross, dot and scale written out), so every cast returns the
  // same bits as the vector form; it allocates nothing per triangle, which is what made a cast slow.
  const [d0, d1, d2] = dir
  let far = 0
  for (const p of parts) {
    const P = p.mesh.positions
    const I = p.mesh.indices
    const [bx, by, bz]: V3 = p.bone === undefined ? [0, 0, 0] : at(rest, p.bone)
    const ox = bx - origin[0]
    const oy = by - origin[1]
    const oz = bz - origin[2]
    for (let i = 0; i < I.length; i += 3) {
      // Möller–Trumbore, the ray from the origin.
      const ia = 3 * at(I, i)
      const ib = 3 * at(I, i + 1)
      const ic = 3 * at(I, i + 2)
      const ax = coordinate(P, ia) + ox
      const ay = coordinate(P, ia + 1) + oy
      const az = coordinate(P, ia + 2) + oz
      const e1x = coordinate(P, ib) + ox - ax
      const e1y = coordinate(P, ib + 1) + oy - ay
      const e1z = coordinate(P, ib + 2) + oz - az
      const e2x = coordinate(P, ic) + ox - ax
      const e2y = coordinate(P, ic + 1) + oy - ay
      const e2z = coordinate(P, ic + 2) + oz - az
      const qx = d1 * e2z - d2 * e2y
      const qy = d2 * e2x - d0 * e2z
      const qz = d0 * e2y - d1 * e2x
      const det = e1x * qx + e1y * qy + e1z * qz
      if (Math.abs(det) < 1e-12) continue
      const tx = ax * -1
      const ty = ay * -1
      const tz = az * -1
      const u = (tx * qx + ty * qy + tz * qz) / det
      const rx = ty * e1z - tz * e1y
      const ry = tz * e1x - tx * e1z
      const rz = tx * e1y - ty * e1x
      const v = (d0 * rx + d1 * ry + d2 * rz) / det
      if (u < 0 || v < 0 || u + v > 1) continue
      far = Math.max(far, (e2x * rx + e2y * ry + e2z * rz) / det)
    }
  }
  return far
}

/** The `j`th number of a flat vertex list, or a RangeError (as `vertexAt` gives) past its end. */
function coordinate(list: readonly number[], j: number): number {
  const value = list[j]
  if (value === undefined) throw new RangeError(`no vertex ${Math.floor(j / 3)}`)
  return value
}
