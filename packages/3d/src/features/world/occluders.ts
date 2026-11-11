// The light's occluders, derived from a built world: what stops a lamp or the sun, and what the contact darkening reads.
// A wall face, a floor and a ceiling are planes; a prop's parts that cast are boxes. A game used to write these by hand.
import type { MeshData } from '../../shared/math/geometry.ts'
import type { OccluderBox, OccluderPlane } from '../../shared/render/light/scene-lighting.schema.ts'
import type { WorldPiece } from './build.ts'

export interface WorldOccluders {
  readonly boxes: OccluderBox[]
  readonly planes: OccluderPlane[]
}

/** A part smaller than this (metres, on any side) shades nothing worth a box: a handle, a stud. */
const MIN_SIDE = 0.02
/** How far a floor's area may be under its bounding rectangle's before the rectangle would cover ground outside it. */
const RECTANGLE = 0.02

interface Bounds {
  readonly lo: [number, number, number]
  readonly hi: [number, number, number]
}

function boundsOf(mesh: MeshData): Bounds {
  const lo: [number, number, number] = [Infinity, Infinity, Infinity]
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.positions.length; i++) {
    const axis = i % 3
    lo[axis] = Math.min(lo[axis] as number, mesh.positions[i] as number)
    hi[axis] = Math.max(hi[axis] as number, mesh.positions[i] as number)
  }
  return { lo, hi }
}

/** The area of the mesh seen from above (its triangles' footprints on the ground). */
function footprint(mesh: MeshData): number {
  const p = mesh.positions
  let sum = 0
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => (mesh.indices[t + k] as number) * 3) as [number, number, number]
    sum +=
      Math.abs(
        ((p[b] as number) - (p[a] as number)) * ((p[c + 2] as number) - (p[a + 2] as number)) -
          ((p[c] as number) - (p[a] as number)) * ((p[b + 2] as number) - (p[a + 2] as number)),
      ) / 2
  }
  return sum
}

/** A wall face as a plane: from its line on the plan and the height its mesh spans, facing where its normals do. */
function wallPlane(piece: WorldPiece, line: { a: readonly [number, number]; b: readonly [number, number] }) {
  const { lo, hi } = boundsOf(piece.mesh)
  const [nx, nz] = [piece.mesh.normals[0] as number, piece.mesh.normals[2] as number]
  const length = Math.hypot(line.b[0] - line.a[0], line.b[1] - line.a[1])
  if (hi[1] - lo[1] <= 0 || length <= 0) return undefined
  const size = Math.hypot(nx, nz)
  return {
    x: (line.a[0] + line.b[0]) / 2,
    y: (lo[1] + hi[1]) / 2,
    z: (line.a[1] + line.b[1]) / 2,
    normal: [nx / size, 0, nz / size] as const,
    width: length,
    height: hi[1] - lo[1],
  }
}

/** A floor or ceiling as a plane over its bounds, or nothing where it is not a rectangle. */
function levelPlane(piece: WorldPiece) {
  const { lo, hi } = boundsOf(piece.mesh)
  const [w, d] = [hi[0] - lo[0], hi[2] - lo[2]]
  if (w <= 0 || d <= 0) return undefined
  if (Math.abs(footprint(piece.mesh) - w * d) > RECTANGLE * w * d) return undefined
  const [nx, ny, nz] = [piece.mesh.normals[0], piece.mesh.normals[1], piece.mesh.normals[2]] as [
    number,
    number,
    number,
  ]
  return {
    x: (lo[0] + hi[0]) / 2,
    y: (lo[1] + hi[1]) / 2,
    z: (lo[2] + hi[2]) / 2,
    normal: [nx, ny, nz] as const,
    width: w,
    height: d,
  }
}

/**
 * The occluders of a world's pieces. A wall face is one plane over its whole face, so a doorway or a window does not
 * let light through it; a floor or ceiling that is not a rectangle (an L-shaped room) gives no plane, and its walls
 * still do. A door, a prop and a part that does not cast are never occluders by their own shape: a prop's parts are
 * boxes over their bounds.
 */
export function worldOccluders(pieces: readonly WorldPiece[]): WorldOccluders {
  const planes: OccluderPlane[] = []
  const boxes: OccluderBox[] = []
  for (const piece of pieces) {
    if (piece.noCast === true) continue
    if (piece.part === 'wall' && piece.line !== undefined) {
      const plane = wallPlane(piece, piece.line)
      if (plane !== undefined) planes.push(plane)
    } else if (piece.part === 'floor' || piece.part === 'ceiling') {
      const plane = levelPlane(piece)
      if (plane !== undefined) planes.push(plane)
    } else if (piece.part === 'prop') {
      const { lo, hi } = boundsOf(piece.mesh)
      const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] as const
      if (size.some((side) => side < MIN_SIDE)) continue
      boxes.push({
        id: piece.id,
        x: (lo[0] + hi[0]) / 2,
        y: lo[1],
        z: (lo[2] + hi[2]) / 2,
        width: size[0],
        height: size[1],
        depth: size[2],
      })
    }
  }
  return { boxes, planes }
}
