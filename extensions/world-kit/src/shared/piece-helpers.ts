// Small helpers the generators share.
import type { MeshData, PropPiece, V3 } from '@automata/3d/props-kit'

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
