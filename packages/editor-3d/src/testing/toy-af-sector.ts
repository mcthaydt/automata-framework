// A small `af-sector/2` level for the tests of the AF profile: a hall and a loading dock half a metre below it, joined
// by a portal pair along x = 8. Every check passes it (the depot sample is a bigger one, shipped as a fixture).
import type { AfSector2File, AfSectorEntry2File } from '@automata/3d/level'

export const toyHall: AfSectorEntry2File = {
  id: 'hall',
  floor: 0,
  ceiling: 4,
  light: 1,
  corners: [
    [0, 0],
    [8, 0, { next: 'dock' }],
    [8, 6],
    [0, 6],
  ],
}

export const toyDock: AfSectorEntry2File = {
  id: 'dock',
  floor: -0.5,
  ceiling: 4,
  light: 0.7,
  corners: [
    [8, 0],
    [14, 0],
    [14, 6],
    [8, 6, { next: 'hall' }],
  ],
}

export const toyAfSector = (more: Partial<AfSector2File> = {}): AfSector2File => ({
  format: 'af-sector/2',
  name: 'toy',
  sectors: [toyHall, toyDock],
  ...more,
})

/** A ramp: the floor rises a quarter metre in a metre along x, and has a surface of its own. */
export const SLOPED: AfSector2File = {
  format: 'af-sector/2',
  name: 'sloped',
  sectors: [
    {
      id: 'ramp',
      floor: { z: 0, slope: [0.25, 0], surface: 'stone' },
      ceiling: 6,
      light: 1,
      corners: [
        [0, 0],
        [8, 0],
        [8, 4],
        [0, 4],
      ],
    },
  ],
}

/** A wall whose surface is a swatch with its placement, not a name. */
export const PLACED: AfSector2File = {
  format: 'af-sector/2',
  name: 'placed',
  sectors: [
    {
      id: 'shop',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0, { surface: { tile: 'tiles', repeat: [2, 1] } }],
        [6, 0],
        [6, 4],
        [0, 4],
      ],
    },
  ],
}

/** A wall with a row of windows, and one with a sign and a shopfront at places along it. */
export const GRID: AfSector2File = {
  format: 'af-sector/2',
  name: 'grid',
  sectors: [
    {
      id: 'shop',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0, { windows: { from: 1, rows: 1, cols: 3, width: 1, height: 1, gap: 0.5 } }],
        [6, 0, { decor: [{ kind: 'sign', pos: 1, width: 1 }] }],
        [6, 4],
        [0, 4],
      ],
    },
  ],
}

/** A wall whose trim is a surface, not heights. */
export const TRIMMED: AfSector2File = {
  format: 'af-sector/2',
  name: 'trimmed',
  sectors: [
    {
      id: 'shop',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0, { trim: 'trimWhite' }],
        [6, 0],
        [6, 4],
        [0, 4],
      ],
    },
  ],
}

/** The room `create-game --template 3d` writes: furniture, a spawn and a definition that is only an id. */
export const CREATE_GAME_ROOM: AfSector2File = {
  format: 'af-sector/2',
  name: 'room',
  title: 'The room',
  sectors: [
    {
      id: 'room',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [-5, -4],
        [5, -4],
        [5, 4],
        [-5, 4],
      ],
      floorTexture: 'floor',
      ceilingTexture: 'ceiling',
      wallTexture: 'wall',
    },
  ],
  props: [
    { id: 'crate-1', use: 'crate', at: [-3.5, 2.8] },
    { id: 'crate-2', use: 'crate', at: [3.5, 2.8], angle: 45 },
    { id: 'barrel-1', use: 'barrel', at: [-3.5, 1.7] },
    { id: 'barrel-2', use: 'barrel', at: [3.5, -2.8] },
  ],
  entityDefs: [{ id: 'spawn' }],
  entities: [{ def: 'spawn', id: 'spawn', x: 0, z: -2 }],
}
