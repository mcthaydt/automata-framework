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

/** The cube's arrays: 4 vertices a face (24), 2 triangles a face (36 indices), counter-clockwise from outside. */
export interface TiledCubeData {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint16Array
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

export function tiledCubeData(span: BoxSpan, tile: number): TiledCubeData {
  const size = [span.x, span.y, span.z] as const
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (const face of FACES) {
    const base = positions.length / 3
    // The four corners in (u, v) on −0.5…0.5, mirrored in u where they would wind inward, so every face winds
    // counter-clockwise seen from outside: the axes (u, v, n) are right-handed when n follows u × v.
    const rightHanded = (face.n + 3 - face.u) % 3 === 2 ? 1 : -1
    const mirror = rightHanded * face.sign < 0 ? -1 : 1
    for (const [cu, cv] of [
      [-0.5 * mirror, -0.5],
      [0.5 * mirror, -0.5],
      [0.5 * mirror, 0.5],
      [-0.5 * mirror, 0.5],
    ] as const) {
      const p = [0, 0, 0]
      p[face.n] = face.sign * 0.5
      p[face.u] = cu
      p[face.v] = cv
      positions.push(...p)
      const n = [0, 0, 0]
      n[face.n] = face.sign
      normals.push(...n)
      uvs.push(((cu + 0.5) * size[face.u]) / tile, ((0.5 - cv) * size[face.v]) / tile)
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  }
}

/** The geometry of `tiledCubeData`. */
export function tiledCube(span: BoxSpan, tile: number): Geometry3D {
  return new Geometry3D(tiledCubeData(span, tile))
}
