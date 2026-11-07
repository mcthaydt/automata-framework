// A small level to dress: one rectangular room of `w` × `d` metres with a door in one wall and a window in another, so
// the dresser has something to keep clear and something to put things under.
import type { AfSector2 } from '@automata/3d/level'

export function room(as: string, seed = 1, w = 6, d = 5): AfSector2 {
  return {
    format: 'af-sector/2',
    name: 'test-room',
    sectors: [
      {
        id: 'room',
        floor: { z: 0 },
        ceiling: { z: 2.8 },
        light: 1,
        corners: [
          [0, 0, { decor: [{ kind: 'window', pos: 3, width: 1.4, height: 1.2, sill: 1 }] }],
          [w, 0, { decor: [{ kind: 'door', pos: 2, width: 0.9, height: 2.1 }] }],
          [w, d],
          [0, d],
        ],
        dress: { as, seed },
      },
    ],
  } as AfSector2
}

/** A 6 × 6 hall with the props given. */
export const levelWith = (props: NonNullable<AfSector2['props']>): AfSector2 => ({
  format: 'af-sector/2',
  name: 't',
  sectors: [
    {
      id: 'hall',
      floor: { z: 0 },
      ceiling: { z: 4 },
      light: 1,
      corners: [
        [0, 0],
        [6, 0],
        [6, 6],
        [0, 6],
      ],
    },
  ],
  props,
})
