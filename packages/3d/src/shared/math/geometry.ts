// Mesh helpers the world's pieces are built with.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/lib/geometry.ts at 6d82a52: `merge` and `tube`.
// Added: `MeshData` (the plain triple every piece is made of) and `windToNormals`, which makes every triangle wind
// the way its vertex normals point, so a renderer may cull back faces (the builder's own raster did not cull).
import {
  apply,
  applyDir,
  compose,
  cross,
  dot,
  IDENTITY_Q,
  lerp,
  normalize,
  type Q,
  sub,
  type V3,
} from './math.ts'

/** Positions, normals (one per position) and triangles (three indices each), as plain arrays. */
export interface MeshData {
  positions: number[]
  normals: number[]
  indices: number[]
}

/** Meshes joined into one. */
export function merge(...meshes: readonly MeshData[]): MeshData {
  const out: MeshData = { positions: [], normals: [], indices: [] }
  for (const mesh of meshes) {
    const base = out.positions.length / 3
    for (const value of mesh.positions) out.positions.push(value)
    for (const value of mesh.normals) out.normals.push(value)
    for (const index of mesh.indices) out.indices.push(index + base)
  }
  return out
}

/** The mesh with each triangle turned over where its winding disagrees with the mean of its vertex normals. */
export function windToNormals(mesh: MeshData): MeshData {
  const { positions: p, normals: n, indices } = mesh
  const out = [...indices]
  for (let t = 0; t < out.length; t += 3) {
    const [a, b, c] = [out[t], out[t + 1], out[t + 2]] as [number, number, number]
    const at = (i: number): V3 => [p[i * 3] as number, p[i * 3 + 1] as number, p[i * 3 + 2] as number]
    const winding = cross(sub(at(b), at(a)), sub(at(c), at(a)))
    const facing: V3 = [0, 1, 2].map(
      (k) => (n[a * 3 + k] as number) + (n[b * 3 + k] as number) + (n[c * 3 + k] as number),
    ) as V3
    if (dot(winding, facing) < 0) {
      out[t + 1] = c
      out[t + 2] = b
    }
  }
  return { positions: p, normals: n, indices: out }
}

type Ring = readonly [y: number, radiusX: number, radiusZ: number, centreZ: number]

export interface TubeOptions {
  readonly seg?: number
  readonly rings?: number
  /** How much it bulges at its middle. */
  readonly belly?: number
  /** Its centre along x. */
  readonly x?: number
  /** Keeps only the angles between its two ends (radians; π/2 is the front). */
  readonly arc?: readonly [number, number]
  /** `[count, depth]`: folds along its length, as a curtain's. */
  readonly folds?: readonly [count: number, depth: number]
}

/** An open tube from the `top` ring to the `bottom` one, each `[y, radius x, radius z, centre z]`. */
export function tube(top: Ring, bottom: Ring, options: TubeOptions = {}): MeshData {
  const rings = options.rings ?? 5
  const belly = options.belly ?? 0
  const centreX = options.x ?? 0
  const { arc, folds } = options
  const seg = options.seg ?? 14
  const columns = arc === undefined ? seg : seg + 1
  const angle = (j: number): number =>
    arc === undefined ? (2 * Math.PI * j) / seg : arc[0] + ((arc[1] - arc[0]) * j) / seg
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const surface = (k: number, v: number): V3 => {
    const y = lerp(top[0], bottom[0], k)
    const swell =
      (1 + belly * Math.sin(Math.PI * k)) *
      (1 + (folds === undefined ? 0 : folds[1] * k * Math.sin(folds[0] * v)))
    return [
      centreX + Math.cos(v) * lerp(top[1], bottom[1], k) * swell,
      y,
      lerp(top[3], bottom[3], k) + Math.sin(v) * lerp(top[2], bottom[2], k) * swell,
    ]
  }
  const epsilon = 1e-3
  for (let i = 0; i <= rings; i++)
    for (let j = 0; j < columns; j++) {
      const k = i / rings
      const v = angle(j)
      const along = sub(surface(Math.min(1, k + epsilon), v), surface(Math.max(0, k - epsilon), v))
      const around = sub(surface(k, v + epsilon), surface(k, v - epsilon))
      let normal = normalize(cross(around, along))
      if (dot(normal, [Math.cos(v), 0, Math.sin(v)]) < 0) normal = [-normal[0], -normal[1], -normal[2]]
      positions.push(...surface(k, v))
      normals.push(...normal)
    }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const next = (j + 1) % columns
      const a = i * columns + j
      const b = i * columns + next
      const c = (i + 1) * columns + next
      const d = (i + 1) * columns + j
      indices.push(a, b, c, a, c, d)
    }
  return windToNormals({ positions, normals, indices })
}

export const sgnPow = (v: number, e: number): number => Math.sign(v) * Math.abs(v) ** e

/** The `i`th vertex of a flat x, y, z list. */
export function vertexAt(list: readonly number[], i: number): V3 {
  const x = list[i * 3]
  const y = list[i * 3 + 1]
  const z = list[i * 3 + 2]
  if (x === undefined || y === undefined || z === undefined) throw new RangeError(`no vertex ${i}`)
  return [x, y, z]
}

/** Moves a mesh (a part authored around the origin) by a turn and an offset. */
export function placed(mesh: MeshData, at: V3, turn: Q = IDENTITY_Q): MeshData {
  const m = compose(turn, at)
  const positions: number[] = []
  const normals: number[] = []
  for (let i = 0; i < mesh.positions.length / 3; i++) {
    positions.push(...apply(m, vertexAt(mesh.positions, i)))
    normals.push(...applyDir(m, vertexAt(mesh.normals, i)))
  }
  return { positions, normals, indices: mesh.indices.slice() }
}
