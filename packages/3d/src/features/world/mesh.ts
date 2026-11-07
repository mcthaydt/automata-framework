// The world's flat-faced primitives: boxes and quads for walls, floors and frames, which want one normal per face (a
// rounded box's normals would band a 6 m wall like a pillow).
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/mesh.ts at 6d82a52: `quad` and
// `box`. The rounded primitives (`rbox`, `cylinder`, `rod`, `cone`, `blob`) come with the props that use them
// (task 7.3). Changed: every triangle winds the way its normal points (`windToNormals`).
import { type MeshData, merge, windToNormals } from '../../shared/math/geometry.ts'
import { normalize, type V3 } from '../../shared/math/math.ts'

export type { MeshData }
export { merge }

/**
 * A flat quad from `o` along `u` and `v` (its normal u × v), cut into `n` × `m` cells so the vertex light has a vertex
 * wherever it needs one.
 */
export function quad(o: V3, u: V3, v: V3, n = 1, m = 1): MeshData {
  const normal = normalize([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]])
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let j = 0; j <= m; j++)
    for (let i = 0; i <= n; i++) {
      const a = i / n
      const b = j / m
      positions.push(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b)
      normals.push(...normal)
    }
  for (let j = 0; j < m; j++)
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i
      indices.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1)
    }
  return windToNormals({ positions, normals, indices })
}

/** The cells a face of `length` metres is cut into: about one per metre and a half, never more than twelve. */
const cells = (length: number): number => Math.max(1, Math.min(12, Math.ceil(length / 1.5)))

/**
 * A box with flat faces, its base’s centre at `at` (y up from it), `size` `[w, h, d]`. `skip` leaves faces out
 * (`-x`, `+x`, `-y`, `+y`, `-z`, `+z`).
 */
export function box(at: V3, size: V3, skip: readonly string[] = []): MeshData {
  const [x, y, z] = at
  const [w, h, d] = size
  const [x0, x1, z0, z1, y1] = [x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + h]
  const faces: [string, MeshData][] = [
    ['+z', quad([x0, y, z1], [w, 0, 0], [0, h, 0], cells(w), cells(h))],
    ['-z', quad([x1, y, z0], [-w, 0, 0], [0, h, 0], cells(w), cells(h))],
    ['+x', quad([x1, y, z1], [0, 0, -d], [0, h, 0], cells(d), cells(h))],
    ['-x', quad([x0, y, z0], [0, 0, d], [0, h, 0], cells(d), cells(h))],
    ['+y', quad([x0, y1, z1], [w, 0, 0], [0, 0, -d], cells(w), cells(d))],
    ['-y', quad([x0, y, z0], [w, 0, 0], [0, 0, d], cells(w), cells(d))],
  ]
  return merge(...faces.filter(([face]) => !skip.includes(face)).map(([, mesh]) => mesh))
}
