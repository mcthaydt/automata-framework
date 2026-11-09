// CPU skinning of a figure's skinned parts ("Drawing"): a skirt's or a coat tail's
// vertices follow the joints they are weighted to, by linear blend, at each pose step. The figure has no GPU skin
// and no glTF skin. A skinned part's mesh is in rest figure space, and every rest rotation is the identity
// (`restPose`), so a joint's rest matrix is its rest position alone and its inverse a translation back.
import type { M, V3 } from '../../../shared/math/math.ts'
import type { Weight } from '../body/mesh.ts'

/** A mesh's vertex data as flat x, y, z lists. */
export interface VertexData {
  readonly positions: Float32Array
  readonly normals: Float32Array
}

/** Each joint's rest position negated: what takes a rest-space vertex into that joint's space. */
export function restInverses(rest: readonly V3[]): V3[] {
  return rest.map(([x, y, z]): V3 => [-x, -y, -z])
}

/**
 * Writes `rest`'s vertices skinned by `world` into `out`: each vertex is `Σ w · world[j] · (v + restInverse[j])`,
 * its normal `Σ w · rotation(world[j]) · n`, renormalised. It writes into `out`'s arrays and allocates nothing, so a
 * pose step costs only the arithmetic.
 */
export function skinPart(
  rest: VertexData,
  weights: readonly (readonly Weight[])[],
  world: readonly M[],
  restInverse: readonly V3[],
  out: VertexData,
): void {
  for (let v = 0; v < weights.length; v++) {
    const i = v * 3
    const px = rest.positions[i] ?? 0
    const py = rest.positions[i + 1] ?? 0
    const pz = rest.positions[i + 2] ?? 0
    const nx = rest.normals[i] ?? 0
    const ny = rest.normals[i + 1] ?? 0
    const nz = rest.normals[i + 2] ?? 0
    let x = 0
    let y = 0
    let z = 0
    let a = 0
    let b = 0
    let c = 0
    for (const [joint, w] of weights[v] ?? []) {
      const m = world[joint]
      const back = restInverse[joint]
      if (m === undefined || back === undefined) throw new RangeError(`no joint ${joint}`)
      const lx = px + back[0]
      const ly = py + back[1]
      const lz = pz + back[2]
      x += w * (m[0] * lx + m[1] * ly + m[2] * lz + m[9])
      y += w * (m[3] * lx + m[4] * ly + m[5] * lz + m[10])
      z += w * (m[6] * lx + m[7] * ly + m[8] * lz + m[11])
      a += w * (m[0] * nx + m[1] * ny + m[2] * nz)
      b += w * (m[3] * nx + m[4] * ny + m[5] * nz)
      c += w * (m[6] * nx + m[7] * ny + m[8] * nz)
    }
    const length = Math.hypot(a, b, c) || 1
    out.positions[i] = x
    out.positions[i + 1] = y
    out.positions[i + 2] = z
    out.normals[i] = a / length
    out.normals[i + 1] = b / length
    out.normals[i + 2] = c / length
  }
}
