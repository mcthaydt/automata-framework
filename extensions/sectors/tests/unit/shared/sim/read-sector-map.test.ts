// The door a level file comes in by: it reads either format, adds what the sim cannot resolve to the reader's own
// problems, and never throws.
import { describe, expect, it } from 'vitest'
import { readSectorMap, resolveLevel } from '#src/entries/sim.ts'
import { clinicMap } from '#src/testing/clinic.ts'

const room = (
  more: object = {},
  corners: unknown[] = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ],
) => ({
  format: 'af-sector/2',
  name: 'test',
  sectors: [{ id: 'ramp', floor: 0, ceiling: 3, light: 1, corners, ...more }],
})

describe('readSectorMap', () => {
  it('reads the clinic with no problem and resolves it', () => {
    const read = readSectorMap(JSON.parse(JSON.stringify(clinicMap())))
    expect(read.problems).toEqual([])
    expect(resolveLevel(read.level).sectors).toHaveLength(7)
  })

  it('names a sloped floor, by room, instead of reading it flat', () => {
    const read = readSectorMap(room({ floor: { z: 0, slope: [0.1, 0] } }))
    expect(read.problems).toMatchObject([{ code: 'sloped-floor', where: 'ramp' }])
  })

  it('reports a portal to no room without throwing', () => {
    const read = readSectorMap(
      room({}, [
        [0, 0, { next: 'nowhere' }],
        [2, 0],
        [2, 2],
        [0, 2],
      ]),
    )
    expect(read.problems).toMatchObject([{ code: 'unknown-portal', where: 'ramp' }])
  })

  it('reports a file that is not a level, with an empty map to go on with', () => {
    const read = readSectorMap({ format: 'tiled/1' })
    expect(read.problems).toMatchObject([{ code: 'unknown-format' }])
    expect(read.level.sectors).toEqual([])
  })
})
