// A two-room blockout for the pipeline's tests (and the fixture `base-adventure` will start from): two rooms whose facing walls stand a
// wall's thickness apart, joined by a doorway with a door.
import type { Blockout } from '@mcthaydt/automata-sector-format/blockout'

export const TOY: Blockout = {
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
}
