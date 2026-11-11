// A small level in AF's af-sector/2 shape (as much of it as the extension reads): a hall and a counter that make the
// reception, a ward, and a corridor with a bulkhead that hides from the hall.
import type { RoomLevel } from '#src/features/room-visibility/room-level.ts'
import type { RoomPolicy } from '#src/features/room-visibility/room-policy.schema.ts'

const square = (
  x: number,
  z: number,
  size = 4,
  walls: Record<number, { next?: string; cut?: string; hideFrom?: string[] }> = {},
) =>
  [
    [x, z, walls[0]],
    [x + size, z, walls[1]],
    [x + size, z + size, walls[2]],
    [x, z + size, walls[3]],
  ] as const

export const LEVEL: RoomLevel = {
  sectors: [
    { id: 'hall', corners: square(0, 0, 4, { 1: { next: 'counter' } }) },
    { id: 'counter', corners: square(4, 0, 2, { 3: { next: 'hall' } }) },
    { id: 'ward', corners: square(0, 4, 4, { 0: { next: 'hall', cut: 'door-wall' } }) },
    { id: 'corridor', corners: square(8, 0, 4, { 3: { cut: 'bulkhead', hideFrom: ['hall'] } }) },
    { id: 'closet', corners: square(8, 4, 2) },
  ],
  masses: [{}, {}],
}

export const POLICY: RoomPolicy = {
  rooms: { reception: ['hall', 'counter'], ward: ['ward'], corridor: ['corridor'], supply: ['closet'] },
  zones: { hall: ['reception', 'ward', 'corridor'], corridor: ['corridor'], closet: ['supply'] },
  masses: { 0: ['reception', 'ward'], 1: 'global' },
}
