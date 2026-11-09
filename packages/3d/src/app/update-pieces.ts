// Applies a change of the pieces' states to the meshes the world is drawn with: a door turns about its hinge, a prop
// moves, turns or goes. Only the pieces whose state changed are touched, so a scene that plays on a timeline pays for
// what moved, and a frame is the same whether it comes after the one before or alone. A piece at its authored state
// sits where the builder put it. Presentation only: the sim never reads it.

import type { WorldPiece } from '../features/world/build.ts'
import { doorOpen, type PieceStates, propState, sameProp } from '../shared/level/piece-states.ts'
import type { WorldView } from './world-view.ts'

/**
 * Turns a mesh about the y axis through `pivot` by `degrees` (the builder's convention: counter-clockwise seen from
 * above) and then moves the pivot to `to`. The mesh keeps its world-space vertices, so its own origin is the world's:
 * a turn about the origin plus the offset that brings the pivot to `to`.
 */
function placeAbout(
  mesh: {
    rotation: { set(x: number, y: number, z: number): void }
    position: { set(x: number, y: number, z: number): void }
  },
  pivot: readonly [number, number, number],
  degrees: number,
  to: readonly [number, number, number],
): void {
  const turn = (degrees * Math.PI) / 180
  const [c, s] = [Math.cos(turn), Math.sin(turn)]
  mesh.rotation.set(0, turn, 0)
  mesh.position.set(
    to[0] - (c * pivot[0] + s * pivot[2]),
    to[1] - pivot[1],
    to[2] - (-s * pivot[0] + c * pivot[2]),
  )
}

/** Moves one door piece to the opening its room is in. */
function turnDoor(view: WorldView, piece: WorldPiece, after: PieceStates): void {
  const mesh = view.mesh(piece.id)
  if (mesh === undefined || piece.door === undefined) return
  placeAbout(mesh, piece.door.hinge, piece.door.swing * doorOpen(after, piece.sector), piece.door.hinge)
}

/** Moves one prop piece to its prop's state (a prop with none stands as placed). */
function moveProp(view: WorldView, piece: WorldPiece, after: PieceStates): void {
  const mesh = view.mesh(piece.id)
  if (mesh === undefined || piece.prop === undefined) return
  const state = propState(after, piece.prop.id)
  mesh.visible = state.hidden !== true
  placeAbout(mesh, piece.prop.at, state.turn ?? 0, state.at ?? piece.prop.at)
}

/**
 * Applies the change from `before` to `after` to the world's meshes and says how many pieces it touched. A door is
 * its room's (`doors[<room id>]`), a prop's pieces move together (`props[<prop id>]`). Lamps are not pieces: a lamp's
 * state reaches the light through `sceneLamps`.
 */
export function updatePieces(view: WorldView, before: PieceStates, after: PieceStates): number {
  let changed = 0
  for (const piece of view.pieces) {
    if (piece.door !== undefined) {
      if (doorOpen(before, piece.sector) === doorOpen(after, piece.sector)) continue
      turnDoor(view, piece, after)
    } else if (piece.prop !== undefined) {
      if (sameProp(propState(before, piece.prop.id), propState(after, piece.prop.id))) continue
      moveProp(view, piece, after)
    } else continue
    changed++
  }
  return changed
}
