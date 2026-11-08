// A 3D level for the tests of what Sequence reads from a room.

export interface RoomsFixture {
  readonly format: string
  readonly name: string
  readonly sectors: readonly {
    readonly id: string
    readonly floor: number
    readonly ceiling: number
    readonly light: number
    readonly corners: readonly (readonly [number, number])[]
  }[]
}

/** Two square rooms side by side, 4 m across. */
export const ROOMS: RoomsFixture = {
  format: 'af-sector/2',
  name: 'rooms',
  sectors: [
    {
      id: 'hall',
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
      id: 'study',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [4, 0],
        [8, 0],
        [8, 4],
        [4, 4],
      ],
    },
  ],
}
