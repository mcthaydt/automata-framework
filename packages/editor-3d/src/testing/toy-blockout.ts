// A small blockout for the tests of the checks: two rooms a wall's thickness apart, joined by a doorway with a door
// (the toy of The Last Light's tests/blockout.test.ts, 92e6704), which every check passes.
import type { Blockout, BlockoutBox, Opening, Room } from '../format/blockout.schema'

export const toyBlockout = (more: Partial<Blockout> = {}): Blockout => ({
  scene: 'toy',
  rooms: [
    {
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
    },
    {
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
    },
  ],
  openings: [{ id: 'ab', from: 'a', to: 'b', span: [1.5, 2.5], ceiling: 2.1, door: 'abDoor' }],
  spawn: { x: 1, y: 0.79, z: 1, facing: 0 },
  boxes: [{ id: 'abDoor', role: 'door', kind: 'door', x: 4.0625, z: 2, y: 1.05, w: 0.12, h: 2.1, d: 1 }],
  hotspots: [{ id: 'far', x: 6, y: 1, z: 3, name: 'Far wall', reach: 1.4 }],
  lamps: [],
  nav: {},
  zones: [{ id: 'a', look: [3.5, 1, 2], distance: 14 }],
  ...more,
})

const toy = toyBlockout()

/** One of the toy's rooms, `a` or `b`, to build a variation of. */
export const toyRoom = (id: 'a' | 'b'): Room => must(toy.rooms.find((room) => room.id === id))

/** The toy's doorway and the door in it. */
export const toyOpening: Opening = must(toy.openings?.[0])
export const toyDoor: BlockoutBox = must(toy.boxes[0])

/** The value, which a test knows is there. */
export function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('the test expected a value that is missing')
  return value
}
