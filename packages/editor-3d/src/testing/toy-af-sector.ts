// A small `af-sector/1` level for the tests of the AF profile: a hall and a loading dock half a metre below it, joined
// by a portal pair along x = 8. Every check passes it (the depot sample is a bigger one, shipped as a fixture).
import type { AfSector, AfSectorEntry } from '@automata/3d/level'

export const toyHall: AfSectorEntry = {
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

export const toyDock: AfSectorEntry = {
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

export const toyAfSector = (more: Partial<AfSector> = {}): AfSector => ({
  format: 'af-sector/1',
  name: 'toy',
  sectors: [toyHall, toyDock],
  ...more,
})
