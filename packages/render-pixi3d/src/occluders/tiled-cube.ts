// A unit cube about its centre whose UVs repeat a texture at a fixed size in metres once the cube is scaled to a box
// (base-3d art direction spec §3.2): a wall's slab is the unit cube scaled to its length, height and thickness, so
// each face's UVs span that face's size over the tile. One cube per textured wall, since the spans differ.
import { Geometry3D } from '@pixi/3d'

/** The box's size in metres along x, y and z, once the cube is scaled. */
export interface BoxSpan {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** The cube's arrays: a grid of quads a face (one quad without `cell`), counter-clockwise from outside. */
export interface TiledCubeData {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint16Array | Uint32Array
}

type Axis = 0 | 1 | 2

/**
 * Each face as its normal axis and sign, and the axes its u and v run along (v down the face, as image rows run). The
 * corners go round counter-clockwise seen from outside.
 */
const FACES: readonly { readonly n: Axis; readonly sign: 1 | -1; readonly u: Axis; readonly v: Axis }[] = [
  { n: 2, sign: 1, u: 0, v: 1 },
  { n: 2, sign: -1, u: 0, v: 1 },
  { n: 0, sign: 1, u: 2, v: 1 },
  { n: 0, sign: -1, u: 2, v: 1 },
  { n: 1, sign: 1, u: 0, v: 2 },
  { n: 1, sign: -1, u: 0, v: 2 },
]

/**
 * The cube's arrays. With `cell` (metres), each face is cut into a grid of cells at most that size once the cube is
 * scaled, so a baked light has vertices to sit on (a face of four corners shades as one flat ramp); without it each
 * face is one quad.
 */
export function tiledCubeData(span: BoxSpan, tile: number, cell?: number): TiledCubeData {
  const size = [span.x, span.y, span.z] as const
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (const face of FACES) {
    const base = positions.length / 3
    // The corners in (u, v) on −0.5…0.5, mirrored in u where they would wind inward, so every face winds
    // counter-clockwise seen from outside: the axes (u, v, n) are right-handed when n follows u × v.
    const rightHanded = (face.n + 3 - face.u) % 3 === 2 ? 1 : -1
    const mirror = rightHanded * face.sign < 0 ? -1 : 1
    const cells = (axis: Axis) => (cell === undefined ? 1 : Math.max(1, Math.ceil(size[axis] / cell - 1e-9)))
    const cu = cells(face.u)
    const cv = cells(face.v)
    for (let j = 0; j <= cv; j++)
      for (let i = 0; i <= cu; i++) {
        const u = (i / cu - 0.5) * mirror
        const v = j / cv - 0.5
        const p = [0, 0, 0]
        p[face.n] = face.sign * 0.5
        p[face.u] = u
        p[face.v] = v
        positions.push(...p)
        const n = [0, 0, 0]
        n[face.n] = face.sign
        normals.push(...n)
        uvs.push(((u + 0.5) * size[face.u]) / tile, ((0.5 - v) * size[face.v]) / tile)
      }
    for (let j = 0; j < cv; j++)
      for (let i = 0; i < cu; i++) {
        const a = base + j * (cu + 1) + i
        indices.push(a, a + 1, a + cu + 2, a, a + cu + 2, a + cu + 1)
      }
  }
  const vertexCount = positions.length / 3
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
  }
}

/** The geometry of `tiledCubeData`. */
export function tiledCube(span: BoxSpan, tile: number, cell?: number): Geometry3D {
  return new Geometry3D(tiledCubeData(span, tile, cell))
}
