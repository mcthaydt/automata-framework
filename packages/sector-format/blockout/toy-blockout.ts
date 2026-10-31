// A two-room blockout for the format's own tests: two rooms whose facing walls stand a wall's thickness apart, joined by a
// doorway with a door.
import type { Blockout, Opening, Room } from './blockout.schema'

// Two rooms whose facing walls stand a wall's thickness apart, joined by a doorway with a door.
export const ROOM_A: Room = {
  id: 'a',
  zone: 'a',
  floor: 0,
  ceiling: 3,
  light: 1,
  corners: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ],
}
export const ROOM_B: Room = {
  id: 'b',
  zone: 'a',
  floor: 0,
  ceiling: 3,
  light: 1,
  corners: [
    [4.125, 0],
    [7, 0],
    [7, 4],
    [4.125, 4],
  ],
}
export const DOORWAY: Opening = {
  id: 'ab',
  from: 'a',
  to: 'b',
  span: [1.5, 2.5],
  ceiling: 2.1,
  door: 'abDoor',
}
export const TOY: Blockout = {
  scene: 'toy',
  rooms: [ROOM_A, ROOM_B],
  openings: [DOORWAY],
  spawn: { x: 1, y: 0.79, z: 1, facing: 0 },
  boxes: [{ id: 'abDoor', role: 'door', kind: 'door', x: 4.0625, z: 2, y: 1.05, w: 0.12, h: 2.1, d: 1 }],
  hotspots: [{ id: 'far', x: 6, y: 1, z: 3, name: 'Far wall', reach: 1.4 }],
  lamps: [],
  nav: {},
  zones: [{ id: 'a', look: [3.5, 1, 2], distance: 14 }],
}
