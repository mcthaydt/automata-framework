// The first slice's area (M3 spec §4.7), in metres: the hall, a doorway in its north wall, and the kiln beyond it,
// each with its own camera view. Hand-written until the rooms are authored in the 3D level editor (GAME-3D.1i).
// 0 looks toward +z; the kiln's view turns the camera to +x, so walking north through the doorway with the stick
// held tests the latch (M3R-D15).
import type { AreaSource } from '../systems/index.ts'

const WALL = 0.2

export const FIRST_SLICE: AreaSource = {
  id: 'first-slice',
  spawn: { x: 0, z: -2 },
  views: [
    { id: 'hall', yawDeg: 0, bounds: { min: [-4, 0, -4], max: [4, 2, 4] } },
    { id: 'kiln', yawDeg: 90, bounds: { min: [-4, 0, 4], max: [4, 2, 12] } },
  ],
  rooms: [
    { view: 'hall', min: [-4, -4], max: [4, 4] },
    { view: 'kiln', min: [-4, 4], max: [4, 12] },
  ],
  walls: [
    { min: [-4 - WALL, -4 - WALL], max: [4 + WALL, -4] }, // the hall's south wall
    { min: [-4 - WALL, -4 - WALL], max: [-4, 12 + WALL] }, // west
    { min: [4, -4 - WALL], max: [4 + WALL, 12 + WALL] }, // east
    { min: [-4 - WALL, 12], max: [4 + WALL, 12 + WALL] }, // the kiln's north wall
    { min: [-4, 4 - WALL / 2], max: [-1, 4 + WALL / 2] }, // the dividing wall, west of the 2 m doorway
    { min: [1, 4 - WALL / 2], max: [4, 4 + WALL / 2] }, // and east of it
  ],
  // The kiln's north wall, in the doorway's line, is the way on: the Cold Kiln's mouth (content/kiln.ts).
  exits: [{ min: [-1, 11.4], max: [1, 12], to: 'cold-kiln', entry: { x: 100, z: 101.5 } }],
  // The second figure, standing in for a lock target.
  targets: [{ x: 2, z: 9 }],
  // The ember, in the kiln’s north-west corner, in reach of Wick standing in the corner: he picks it up (F) to end the run.
  ember: { x: -3.2, z: 11.2 },
}
