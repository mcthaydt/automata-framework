// Draws a level's pieces room by room: each room's pieces go into a layer that room owns, and a wall piece is put in its
// cutaway group as it is drawn, so the one call sets up both the room masks and the wall hider.

import type { Container3D } from '@pixi/3d'
import type { RoomOwnership } from './room-ownership.ts'
import { type RoomPolicy, roomOfSector } from './room-policy.schema.ts'
import { type WallGroup, type WallPiece, wallGroupOfPiece } from './wall-groups.ts'
import type { Hideable, WallHider } from './wall-hider.ts'

/** A piece the builder made: its id, the sector it is in, and (for a wall) its line on the plan. */
export interface RoomPiece extends WallPiece {
  readonly id: string
  readonly sector: string
}

export interface DrawByRoom<P extends RoomPiece> {
  readonly owned: RoomOwnership
  readonly policy: RoomPolicy
  readonly groups: readonly WallGroup[]
  readonly hider: WallHider
  readonly pieces: readonly P[]
  /** Draws pieces into a parent and says how to find a piece's mesh (`drawWorld` from `@automata/3d` does). */
  readonly draw: (parent: Container3D, pieces: P[]) => { mesh(id: string): Hideable | undefined }
}

/** A piece whose sector is in no room is not drawn (`checkRoomPolicy` says so beforehand). */
export function drawByRoom<P extends RoomPiece>(o: DrawByRoom<P>): void {
  const roomOf = roomOfSector(o.policy)
  for (const room of Object.keys(o.policy.rooms)) {
    const pieces = o.pieces.filter((piece) => roomOf.get(piece.sector) === room)
    const drawn = o.draw(o.owned.layer([room]), pieces)
    for (const piece of pieces) {
      const group = wallGroupOfPiece(o.groups, piece)
      const mesh = drawn.mesh(piece.id)
      if (group && mesh) o.hider.add(group.id, mesh)
    }
  }
}
