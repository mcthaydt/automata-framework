// Small helpers the generators share.
import {
  box,
  cylinder,
  type MeshData,
  merge,
  type PropPiece,
  rod,
  type V3,
} from '@automataframework/3d/props-kit'
import { turnZ } from './turn.ts'

/** The four corners of a footprint, as signs: where a table's or a stool's legs stand. */
export const CORNERS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const

/** A piece with its mesh moved up by `dy` (lettering sits on a panel's face, not at the origin). */
export function lifted(piece: PropPiece, dy: number): PropPiece {
  const positions = piece.mesh.positions.map((v, i) => (i % 3 === 1 ? v + dy : v))
  return { ...piece, mesh: { ...piece.mesh, positions } }
}

/** The box round a list of meshes as [low, high] corners, or null when they hold no vertex. */
export function boundsOfMesh(meshes: readonly MeshData[]): [V3, V3] | null {
  const low: V3 = [Infinity, Infinity, Infinity]
  const high: V3 = [-Infinity, -Infinity, -Infinity]
  let any = false
  for (const mesh of meshes)
    for (let i = 0; i + 2 < mesh.positions.length; i += 3) {
      any = true
      for (let k = 0; k < 3; k++) {
        const v = mesh.positions[i + k] as number
        if (v < (low[k] as number)) low[k] = v
        if (v > (high[k] as number)) high[k] = v
      }
    }
  return any ? [low, high] : null
}

/**
 * A hoop: a ring of thin rods round `centre`, in the plane the ring lies in (`yz` stands it up beside a chair, a wheel
 * with its axle along x; `xy` hangs it on a wall facing +z, a clock's bezel). Rods, not a tube, so a wheel reads as a
 * wheel at the pixel size the props are drawn at.
 */
export function hoop(centre: V3, radius: number, tube: number, plane: 'xy' | 'yz', seg = 16): MeshData {
  const point = (i: number): V3 => {
    const a = (2 * Math.PI * i) / seg
    const [u, v] = [Math.sin(a) * radius, Math.cos(a) * radius]
    return plane === 'yz'
      ? [centre[0], centre[1] + v, centre[2] + u]
      : [centre[0] + u, centre[1] + v, centre[2]]
  }
  return merge(...Array.from({ length: seg }, (_, i) => rod(point(i), point(i + 1), tube, 4)))
}

/** A castor standing at `[x, z]` on the floor: a wheel on its side and the stem above it. */
export function castor(x: number, z: number, radius = 0.05): MeshData {
  const width = radius * 0.7
  return merge(
    turnZ(cylinder([0, -width / 2, 0], radius, width, 8, 0.5), 90, [x, radius, z]),
    box([x, radius * 1.4, z], [radius * 0.5, radius * 0.9, radius * 0.5]),
  )
}
