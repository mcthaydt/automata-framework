// A unit cube about its centre cut into cells and coloured per vertex (base-3d art pass, step 12: vertex colour only).
// Each face is a grid of cells at most `cell` metres once the cube is scaled to a box, so a colour that changes over
// the box (moss, damp, darkening toward the base) blends smoothly across it vertex by vertex, with no texture.
import { Geometry3D } from '@pixi/3d'
import type { Vec3 } from '../camera/camera-pose.js'

/** The box's size in metres along x, y and z, once the cube is scaled. */
export interface BoxSpan {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * A vertex's colour, 0xRRGGBB in sRGB: `offset` is the vertex from the box's centre in metres, `normal` its face's
 * outward normal, both along the box's own axes.
 */
export type CellColor = (offset: Vec3, normal: Vec3) => number

/** The cube's arrays: positions and normals 3 floats a vertex, colours 4 (linear RGBA, as `@pixi/3d` reads them). */
export interface CellCubeData {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly colors: Float32Array
  readonly indices: Uint16Array | Uint32Array
}

type Axis = 0 | 1 | 2

/** Each face as its normal axis and sign, and the two axes its grid runs along. */
const FACES: readonly { readonly n: Axis; readonly sign: 1 | -1; readonly u: Axis; readonly v: Axis }[] = [
  { n: 2, sign: 1, u: 0, v: 1 },
  { n: 2, sign: -1, u: 0, v: 1 },
  { n: 0, sign: 1, u: 2, v: 1 },
  { n: 0, sign: -1, u: 2, v: 1 },
  { n: 1, sign: 1, u: 0, v: 2 },
  { n: 1, sign: -1, u: 0, v: 2 },
]

/** One sRGB channel (0..255) as linear light. */
const linear = (c: number): number => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

const vec = (p: readonly number[]): Vec3 => ({ x: p[0] ?? 0, y: p[1] ?? 0, z: p[2] ?? 0 })

/** How the colours fall: `flat` gives each cell one colour, asked at its centre, with hard edges between cells. */
export interface CellOptions {
  readonly flat?: boolean | undefined
}

export function cellCubeData(
  span: BoxSpan,
  cell: number,
  colorAt: CellColor,
  options: CellOptions = {},
): CellCubeData {
  const size = [span.x, span.y, span.z] as const
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  for (const face of FACES) {
    const base = positions.length / 3
    const cu = Math.max(1, Math.ceil(size[face.u] / cell - 1e-9))
    const cv = Math.max(1, Math.ceil(size[face.v] / cell - 1e-9))
    const n = [0, 0, 0]
    n[face.n] = face.sign
    // (u, v, n) right-handed means u × v points along +n: the grid's (i, j) order winds counter-clockwise when that
    // matches the face's sign, so the other faces take the other order.
    const forward = ((face.n + 3 - face.u) % 3 === 2 ? 1 : -1) * face.sign > 0
    const point = (i: number, j: number): number[] => {
      const p = [0, 0, 0]
      p[face.n] = face.sign * 0.5
      p[face.u] = i / cu - 0.5
      p[face.v] = j / cv - 0.5
      return p
    }
    const colourOf = (p: readonly number[]): number[] => {
      const rgb = colorAt(vec(p.map((c, k) => c * (size[k] ?? 0))), vec(n))
      return [linear((rgb >> 16) & 255), linear((rgb >> 8) & 255), linear(rgb & 255), 1]
    }
    const quad = (a: number, b: number, c: number, d: number) => {
      if (forward) indices.push(a, b, c, a, c, d)
      else indices.push(a, c, b, a, d, c)
    }
    if (options.flat) {
      // Each cell its own four corners, all in the colour at the cell's centre.
      for (let j = 0; j < cv; j++)
        for (let i = 0; i < cu; i++) {
          const first = positions.length / 3
          const rgba = colourOf(point(i + 0.5, j + 0.5))
          for (const [di, dj] of [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ] as const) {
            positions.push(...point(i + di, j + dj))
            normals.push(...n)
            colors.push(...rgba)
          }
          quad(first, first + 1, first + 2, first + 3)
        }
      continue
    }
    for (let j = 0; j <= cv; j++)
      for (let i = 0; i <= cu; i++) {
        const p = point(i, j)
        positions.push(...p)
        normals.push(...n)
        colors.push(...colourOf(p))
      }
    for (let j = 0; j < cv; j++)
      for (let i = 0; i < cu; i++) {
        const a = base + j * (cu + 1) + i
        quad(a, a + 1, a + cu + 2, a + cu + 1)
      }
  }
  const vertexCount = positions.length / 3
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
  }
}

/** The geometry of `cellCubeData`: a material shows its colours with `vertexColors` on. */
export function cellCube(
  span: BoxSpan,
  cell: number,
  colorAt: CellColor,
  options: CellOptions = {},
): Geometry3D {
  return new Geometry3D(cellCubeData(span, cell, colorAt, options))
}
