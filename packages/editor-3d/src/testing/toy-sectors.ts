// Small rooms for the geometry tests' toy cases.
import type { Corner, SectorDef } from '../format/expand'

/** The corners of an axis-aligned rectangle, counter-clockwise on the plan. */
export const square = (x0: number, z0: number, x1: number, z1: number): Corner[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
]

/** A sector with the plainest values: 3 m high from the floor at 0 unless `more` says otherwise. */
export const room = (id: string, corners: Corner[], more: Partial<SectorDef> = {}): SectorDef => ({
  id,
  zone: 'z',
  floor: 0,
  ceiling: 3,
  light: 1,
  corners,
  ...more,
})
