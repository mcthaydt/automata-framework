// The map's content checks: a `sector-map` is the sector format's sectors and masses (no field of its
// own), and a map whose geometry cannot be resolved fails where it is written.
import { describe, expect, it } from 'vitest'
import { type SectorMap, sectorMapSchema } from '#src/shared/sim/sector-map.schema.ts'
import { clinicMap } from '#src/testing/clinic.ts'

const square = (id: string, x = 0, more: object = {}) => ({
  id,
  zone: id,
  floor: 0,
  ceiling: 3,
  light: 1,
  corners: [
    [x, 0],
    [x + 2, 0],
    [x + 2, 2],
    [x, 2],
  ],
  ...more,
})

const issues = (map: unknown) => {
  const result = sectorMapSchema.safeParse(map)
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
}

describe('sectorMapSchema', () => {
  it('takes the clinic as it is', () => {
    expect(issues(clinicMap())).toEqual([])
  })

  it('fails a self-intersecting loop at the corner that starts the crossing wall', () => {
    const bowTie = square('ward', 0, {
      corners: [
        [0, 0],
        [2, 2],
        [2, 0],
        [0, 2],
      ],
    })
    expect(issues({ sectors: [bowTie] })).toEqual([
      {
        path: ['sectors', 0, 'corners', 2],
        message: 'ward: the wall from corner 2 crosses the wall from corner 0',
      },
    ])
  })

  it('fails a self-intersecting hole at its own path', () => {
    const room = square('ward', 0, {
      corners: [
        [0, 0],
        [6, 0],
        [6, 6],
        [0, 6],
      ],
      holes: [
        [
          [1, 1],
          [3, 3],
          [3, 1],
          [1, 3],
        ],
      ],
    })
    expect(issues({ sectors: [room] })).toEqual([
      {
        path: ['sectors', 0, 'holes', 0, 2],
        message: 'ward: the wall from corner 2 crosses the wall from corner 0',
      },
    ])
  })

  it('fails a loop of fewer than three corners and a wall of no length', () => {
    expect(
      issues({
        sectors: [
          square('a', 0, {
            corners: [
              [0, 0],
              [1, 0],
            ],
          }),
        ],
      }),
    ).toEqual([{ path: ['sectors', 0, 'corners'], message: 'a: a loop needs at least three corners' }])
    expect(
      issues({
        sectors: [
          square('a', 0, {
            corners: [
              [0, 0],
              [0, 0],
              [1, 1],
              [0, 1],
            ],
          }),
        ],
      }),
    ).toEqual([{ path: ['sectors', 0, 'corners', 0], message: 'a: the wall from corner 0 has no length' }])
  })

  it('fails a portal into a sector the map does not have, and a sector id used twice', () => {
    const portal = square('a', 0, {
      corners: [
        [0, 0, { next: 'nowhere' }],
        [2, 0],
        [2, 2],
        [0, 2],
      ],
    })
    expect(issues({ sectors: [portal] })).toEqual([
      { path: ['sectors', 0, 'corners', 0, 2, 'next'], message: 'a: no sector "nowhere" for this portal' },
    ])
    expect(issues({ sectors: [square('a'), square('a', 4)] })).toEqual([
      { path: ['sectors', 1, 'id'], message: 'the sector id "a" is used twice' },
    ])
  })

  it('adds no field to the format: a member the format does not know is kept, not read', () => {
    const map: SectorMap = { sectors: [square('a', 0, { newer: 1 }) as never] }
    expect(sectorMapSchema.parse(map)).toEqual(map)
  })
})
