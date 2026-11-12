import type { WorldPiece } from '@automata/3d'
import type { Obstacle } from '../../shared/obstacles.ts'

// What each prop of the level takes of the floor: the box of its blockout's drawn parts on the plan. The blockout owns the
// footprint, so a mesh drawn in its place changes nothing here. This reads the built level, which the sim never does: the
// result goes into the play content (`app/content.ts`).

/** A prop whose lowest part is above this (metres) hangs, sits or stands raised: it does not stop a walker on the floor. */
const FLOOR_REACH = 0.1
/** A prop thinner than this on either side (metres) is a fitting on a wall, which the wall already stops. */
const THINNEST = 0.1
/** A prop whose highest part is below this (metres) lies on the floor, a sheet of paper: a walker steps over it. */
const FLAT = 0.05

/** A millimetre, so every engine reads the same box from trig that may differ in its last digit. */
const mm = (metres: number): number => Math.round(metres * 1000) / 1000

/** The boxes of the props that stand on the floor, one for each, in the order the level lists them. */
export function obstaclesOf(pieces: readonly WorldPiece[]): Obstacle[] {
  const boxes = new Map<string, { x0: number; y0: number; y1: number; z0: number; x1: number; z1: number }>()
  for (const piece of pieces) {
    if (piece.part !== 'prop' || piece.prop === undefined) continue
    const box = boxes.get(piece.prop.id) ?? {
      x0: Infinity,
      y0: Infinity,
      y1: -Infinity,
      z0: Infinity,
      x1: -Infinity,
      z1: -Infinity,
    }
    const positions = piece.mesh.positions
    for (let at = 0; at < positions.length; at += 3) {
      box.x0 = Math.min(box.x0, positions[at] as number)
      box.y0 = Math.min(box.y0, positions[at + 1] as number)
      box.z0 = Math.min(box.z0, positions[at + 2] as number)
      box.y1 = Math.max(box.y1, positions[at + 1] as number)
      box.x1 = Math.max(box.x1, positions[at] as number)
      box.z1 = Math.max(box.z1, positions[at + 2] as number)
    }
    boxes.set(piece.prop.id, box)
  }
  return [...boxes].flatMap(([id, box]) =>
    box.y0 > FLOOR_REACH || box.y1 < FLAT || box.x1 - box.x0 < THINNEST || box.z1 - box.z0 < THINNEST
      ? []
      : [{ id, x0: mm(box.x0), z0: mm(box.z0), x1: mm(box.x1), z1: mm(box.z1) }],
  )
}
