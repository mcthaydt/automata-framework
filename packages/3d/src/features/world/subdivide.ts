// Subdivision: a mesh cut until no triangle edge is longer than `seg`, so the vertex light has a vertex wherever a
// lamp's pool or a shadow's edge needs one. A big wall or floor is two triangles; lit per vertex it would take one
// colour at each corner and nothing between.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/subdivide.ts at 6d82a52.
import type { MeshData } from '../../shared/math/geometry.ts'

/** The most triangles a mesh may grow to: a `seg` far under the mesh's size is a mistake, not a request. */
const MAX_TRIANGLES = 2 ** 20

/**
 * A mesh split until no triangle edge is longer than `seg` (metres): longest-edge bisection, a shared edge split once
 * (a midpoint cache keyed by the edge's two vertex indices, so neighbours stay crack-free), each new normal the
 * normalised mean of the edge's. `seg` ≤ 0 returns the mesh itself. Deterministic.
 */
export function subdivide(mesh: MeshData, seg: number): MeshData {
  if (seg <= 0) return mesh
  const positions = [...mesh.positions]
  const normals = [...mesh.normals]
  const midpoints = new Map<number, number>()
  const out: number[] = []
  const length = (a: number, b: number): number =>
    Math.hypot(
      (positions[a * 3] as number) - (positions[b * 3] as number),
      (positions[a * 3 + 1] as number) - (positions[b * 3 + 1] as number),
      (positions[a * 3 + 2] as number) - (positions[b * 3 + 2] as number),
    )
  /** The midpoint of an edge: made on the first ask, the same vertex after. */
  const midpoint = (a: number, b: number): number => {
    const key = a < b ? a * 0x100000000 + b : b * 0x100000000 + a
    const known = midpoints.get(key)
    if (known !== undefined) return known
    const made = positions.length / 3
    midpoints.set(key, made)
    for (let c = 0; c < 3; c++)
      positions.push(((positions[a * 3 + c] as number) + (positions[b * 3 + c] as number)) / 2)
    const sum = [0, 1, 2].map((c) => (normals[a * 3 + c] as number) + (normals[b * 3 + c] as number))
    const size = Math.hypot(sum[0] as number, sum[1] as number, sum[2] as number)
    // Opposed normals (a degenerate fold) have no mean: keep the first's.
    if (size > 1e-12) normals.push(...sum.map((v) => v / size))
    else normals.push(normals[a * 3] as number, normals[a * 3 + 1] as number, normals[a * 3 + 2] as number)
    return made
  }
  // A stack, so the order is fixed by the input's: each triangle is popped, emitted or split in two (winding kept).
  const stack: [number, number, number][] = []
  for (let t = mesh.indices.length - 3; t >= 0; t -= 3)
    stack.push([mesh.indices[t] as number, mesh.indices[t + 1] as number, mesh.indices[t + 2] as number])
  let count = stack.length
  for (let triangle = stack.pop(); triangle !== undefined; triangle = stack.pop()) {
    const [a, b, c] = triangle
    const [ab, bc, ca] = [length(a, b), length(b, c), length(c, a)]
    const longest = Math.max(ab, bc, ca)
    if (longest <= seg) {
      out.push(a, b, c)
      continue
    }
    if (++count > MAX_TRIANGLES)
      throw new Error(`subdivide: more than ${MAX_TRIANGLES} triangles at seg ${seg}`)
    // Split the longest edge x→y at m, the third corner z: (x, m, z) and (m, y, z) go the way (x, y, z) did.
    const [x, y, z] = longest === ab ? [a, b, c] : longest === bc ? [b, c, a] : [c, a, b]
    const m = midpoint(x as number, y as number)
    stack.push([m, y as number, z as number], [x as number, m, z as number])
  }
  return { positions, normals, indices: out }
}
