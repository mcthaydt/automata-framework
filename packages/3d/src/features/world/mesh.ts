// The world's flat-faced primitives: boxes and quads for walls, floors and frames, which want one normal per face (a
// rounded box's normals would band a 6 m wall like a pillow).
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/mesh.ts at 6d82a52: `quad`, `box`
// and the rounded primitives the base props are made of (`rbox`, `cylinder`, `rod`, `cone`, `blob`).
// Changed: every triangle winds the way its normal points (`windToNormals`), and the figure's own primitives come
// from `shared/math`, where the figures and the world both reach them.
import { type MeshData, merge, placed, windToNormals } from '../../shared/math/geometry.ts'
import { axisAngle, normalize, type Q, type V3 } from '../../shared/math/math.ts'
import { noise3 } from '../../shared/math/noise.ts'
import { superquadric } from '../../shared/math/superquadric.ts'

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

/**
 * A rounded box (a superquadric): its base's centre at `at`, `size` `[w, h, d]`, `round` 0.1 a crisp bevel up to 1 a
 * pillow. The bevel catches the key light as a pixel artist's lit edge does.
 */
export function rbox(at: V3, size: V3, round = 0.2, seg = 12): MeshData {
  const [w, h, d] = size
  return windToNormals(
    superquadric({
      at: [at[0], at[1] + h / 2, at[2]],
      r: [w / 2, h / 2, d / 2],
      e: [round, round],
      seg,
      rings: Math.max(7, Math.round(seg * 0.6)),
    }),
  )
}

/** An upright cylinder (flat-ended, round across): base centre `at`, radius, height. */
export function cylinder(at: V3, radius: number, height: number, seg = 12, round = 0.15): MeshData {
  return windToNormals(
    superquadric({
      at: [at[0], at[1] + height / 2, at[2]],
      r: [radius, height / 2, radius],
      e: [round, 1],
      seg,
      rings: 7,
    }),
  )
}

/** A cylinder between two points (a pole's arm, a branch, a table leg on a slant). */
export function rod(a: V3, b: V3, radius: number, seg = 8): MeshData {
  const along: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const length = Math.hypot(...along)
  const n = normalize(along)
  // The axis that turns up onto n is up × n = (n.z, 0, −n.x).
  const axis: V3 = [n[2], 0, -n[0]]
  const turn: Q =
    Math.hypot(...axis) < 1e-6
      ? n[1] > 0
        ? [0, 0, 0, 1]
        : axisAngle([1, 0, 0], Math.PI)
      : axisAngle(axis, Math.acos(Math.max(-1, Math.min(1, n[1]))))
  const body = superquadric({
    at: [0, length / 2, 0],
    r: [radius, length / 2, radius],
    e: [0.3, 1],
    seg,
    rings: 5,
  })
  return windToNormals(placed(body, a, turn))
}

/** A cone (a pine's tier, a lamp shade): base centre `at`, the radius at the base and at the top, height. */
export function cone(at: V3, bottom: number, top: number, height: number, seg = 12): MeshData {
  return windToNormals(
    superquadric({
      at: [at[0], at[1] + height / 2, at[2]],
      r: [bottom, height / 2, bottom],
      e: [0.25, 1],
      taper: [1, Math.max(0.02, top / bottom)],
      seg,
      rings: 7,
    }),
  )
}

interface BlobOptions {
  /** Roundness: 1 a sphere. */
  readonly e?: number
  /** How lumpy, as a share of its radius: a smooth seeded noise on its surface. */
  readonly lump?: number
  readonly seed?: number
  readonly seg?: number
  /** Cuts the underside flat below this share of the radius (a rock sits on it). */
  readonly flat?: number
}

/** A blob (foliage, a rock, a cushion): an ellipsoid with radii `r`, lumpy as asked, its centre at `at`. */
export function blob(at: V3, r: V3, options: BlobOptions = {}): MeshData {
  const e = options.e ?? 1
  const seg = options.seg ?? 14
  const lump = options.lump ?? 0
  const seed = options.seed ?? 0
  const mesh = superquadric({ at: [0, 0, 0], r, e: [e, e], seg, rings: Math.round(seg * 0.6) })
  const p = mesh.positions
  for (let i = 0; i < p.length; i += 3) {
    const [x, y, z] = [(p[i] as number) / r[0], (p[i + 1] as number) / r[1], (p[i + 2] as number) / r[2]]
    if (lump !== 0) {
      const k = 1 + lump * (noise3(x * 1.7 + seed * 3.1, y * 1.7 + seed, z * 1.7) - 0.5) * 2
      p[i] = (p[i] as number) * k
      p[i + 1] = (p[i + 1] as number) * k
      p[i + 2] = (p[i + 2] as number) * k
    }
    if (options.flat !== undefined && (p[i + 1] as number) < -r[1] * options.flat)
      p[i + 1] = -r[1] * options.flat
    p[i] = (p[i] as number) + at[0]
    p[i + 1] = (p[i + 1] as number) + at[1]
    p[i + 2] = (p[i + 2] as number) + at[2]
  }
  return windToNormals(mesh)
}
