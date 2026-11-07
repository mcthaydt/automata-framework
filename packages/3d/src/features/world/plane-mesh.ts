// The meshes of a room's shell: a floor or ceiling as cut triangles, a wall as a quad, and the two moves that put a
// piece authored in a wall's own frame (or turned on a hinge) where it belongs.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/map.ts at 6d82a52 (`planeMesh`,
// `wallQuad`, `onWall`, `rotY`). Changed: the plane is `/2`'s, a room with holes is filled from `fill`'s bridged
// polygon, and every triangle winds the way its normal points.

import type { Plane } from '../../shared/level/af-sector-2.schema.ts'
import { type MeshData, windToNormals } from '../../shared/math/geometry.ts'
import type { V3 } from '../../shared/math/math.ts'
import { heightAt, type V2 } from './sectors.ts'

/** World space is `(x, height, z)`: a level point `(x, z)` at `height`. */
export const at = (x: number, z: number, height: number): V3 => [x, height, z]

/** The metres a floor or ceiling is cut to, for the vertex light and the shadow map. */
const PLANE_CELL = 1.2
/** The metres a wall is cut to, along and up. */
const WALL_CELL = 1

/** A room's floor or ceiling over the polygon `points` / `triangles`; a ceiling faces down. */
export function planeMesh(
  points: readonly V2[],
  triangles: readonly number[],
  plane: Plane,
  origin: V2,
  ceiling: boolean,
): MeshData {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const slope = plane.slope ?? [0, 0]
  const length = Math.hypot(-slope[0], 1, -slope[1])
  const side = ceiling ? -1 : 1
  const normal: V3 = [(side * -slope[0]) / length, side / length, (side * -slope[1]) / length]
  const put = (x: number, z: number): number => {
    positions.push(...at(x, z, heightAt(plane, origin, x, z)))
    normals.push(...normal)
    return positions.length / 3 - 1
  }
  for (let t = 0; t < triangles.length; t += 3) {
    const [A, B, C] = [0, 1, 2].map((k) => points[triangles[t + k] as number]) as [V2, V2, V2]
    const size = Math.max(
      Math.hypot(B[0] - A[0], B[1] - A[1]),
      Math.hypot(C[0] - B[0], C[1] - B[1]),
      Math.hypot(A[0] - C[0], A[1] - C[1]),
    )
    const n = Math.max(1, Math.ceil(size / PLANE_CELL))
    // The triangle cut n times along each edge.
    const grid: number[][] = []
    for (let i = 0; i <= n; i++) {
      grid.push([])
      for (let j = 0; j <= n - i; j++) {
        const u = i / n
        const w = j / n
        grid[i]?.push(
          put(A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * w, A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * w),
        )
      }
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n - i; j++) {
        indices.push(grid[i]?.[j] as number, grid[i + 1]?.[j] as number, grid[i]?.[j + 1] as number)
        if (j < n - i - 1)
          indices.push(grid[i + 1]?.[j] as number, grid[i + 1]?.[j + 1] as number, grid[i]?.[j + 1] as number)
      }
  }
  return windToNormals({ positions, normals, indices })
}

/** A wall quad from level point `a` to `b`, between heights `[low, high]` at each end, facing `n`. */
export function wallQuad(
  a: V2,
  b: V2,
  atA: readonly [number, number],
  atB: readonly [number, number],
  n: V2,
): MeshData {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1])
  const cells = Math.max(1, Math.ceil(length / WALL_CELL))
  const rows = Math.max(1, Math.ceil(Math.max(atA[1] - atA[0], atB[1] - atB[0]) / WALL_CELL))
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cells; i++) {
      const u = i / cells
      const v = j / rows
      const low = atA[0] + (atB[0] - atA[0]) * u
      const high = atA[1] + (atB[1] - atA[1]) * u
      positions.push(...at(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, low + (high - low) * v))
      normals.push(n[0], 0, n[1])
    }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cells; i++) {
      const p = j * (cells + 1) + i
      indices.push(p, p + 1, p + cells + 2, p, p + cells + 2, p + cells + 1)
    }
  return windToNormals({ positions, normals, indices })
}

/**
 * A mesh authored in a wall's own frame (x along the wall, y up, z out of it into the room) placed on the wall at
 * level point `o`, standing on `floor`, the room on the side of the inward normal `n`.
 */
export function onWall(mesh: MeshData, o: V2, floor: number, n: V2): MeshData {
  // The frame is right-handed: u = (n.z, 0, −n.x), and u × up = n.
  const normal: V3 = [n[0], 0, n[1]]
  const u: V3 = [normal[2], 0, -normal[0]]
  const { positions: P, normals: N } = mesh
  const positions = new Array<number>(P.length)
  const normals = new Array<number>(N.length)
  for (let i = 0; i < P.length; i += 3) {
    const [x, y, z] = [P[i] as number, P[i + 1] as number, P[i + 2] as number]
    positions[i] = o[0] + u[0] * x + normal[0] * z
    positions[i + 1] = floor + y
    positions[i + 2] = o[1] + u[2] * x + normal[2] * z
    const [nx, ny, nz] = [N[i] as number, N[i + 1] as number, N[i + 2] as number]
    normals[i] = u[0] * nx + normal[0] * nz
    normals[i + 1] = ny
    normals[i + 2] = u[2] * nx + normal[2] * nz
  }
  return windToNormals({ positions, normals, indices: mesh.indices })
}

/** A mesh turned about y by `degrees` (counter-clockwise seen from above in world x, z) and moved to `to`. */
export function rotateY(mesh: MeshData, degrees: number, to: V3): MeshData {
  const c = Math.cos((degrees * Math.PI) / 180)
  const s = Math.sin((degrees * Math.PI) / 180)
  const { positions: P, normals: N } = mesh
  const positions = new Array<number>(P.length)
  const normals = new Array<number>(N.length)
  for (let i = 0; i < P.length; i += 3) {
    const [x, y, z] = [P[i] as number, P[i + 1] as number, P[i + 2] as number]
    positions[i] = c * x + s * z + to[0]
    positions[i + 1] = y + to[1]
    positions[i + 2] = -s * x + c * z + to[2]
    const [nx, ny, nz] = [N[i] as number, N[i + 1] as number, N[i + 2] as number]
    normals[i] = c * nx + s * nz
    normals[i + 1] = ny
    normals[i + 2] = -s * nx + c * nz
  }
  return { positions, normals, indices: mesh.indices }
}
