// The level's checks: a level the sim cannot resolve is reported, as a `LevelProblem`, where it is written, and
// nothing throws.
import { describe, expect, it } from 'vitest'
import { checkLevel, type SectorMap } from '#src/shared/sim/check-level.ts'
import { clinicMap } from '#src/testing/clinic.ts'

const square = (id: string, x = 0, more: object = {}) => ({
  id,
  zone: id,
  floor: { z: 0 },
  ceiling: { z: 3 },
  light: 1,
  corners: [
    [x, 0],
    [x + 2, 0],
    [x + 2, 2],
    [x, 2],
  ],
  ...more,
})

const issues = (map: unknown) =>
  checkLevel(map as SectorMap).map((problem) => ({
    path: problem.path,
    code: problem.code,
    message: problem.message,
    where: problem.where,
  }))

describe('checkLevel', () => {
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
        code: 'wall-crossing',
        message: 'ward: the wall from corner 2 crosses the wall from corner 0',
        where: 'ward',
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
        code: 'wall-crossing',
        message: 'ward: the wall from corner 2 crosses the wall from corner 0',
        where: 'ward',
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
    ).toEqual([
      {
        path: ['sectors', 0, 'corners'],
        code: 'short-loop',
        message: 'a: a loop needs at least three corners',
        where: 'a',
      },
    ])
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
    ).toEqual([
      {
        path: ['sectors', 0, 'corners', 0],
        code: 'zero-wall',
        message: 'a: the wall from corner 0 has no length',
        where: 'a',
      },
    ])
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
      {
        path: ['sectors', 0, 'corners', 0, 2, 'next'],
        code: 'unknown-portal',
        message: 'a: no sector "nowhere" for this portal',
        where: 'a',
      },
    ])
    expect(issues({ sectors: [square('a'), square('a', 4)] })).toEqual([
      {
        path: ['sectors', 1, 'id'],
        code: 'duplicate-id',
        message: 'the sector id "a" is used twice',
        where: 'a',
      },
    ])
  })

  it('reports a sloped floor or ceiling instead of reading it flat', () => {
    const ramp = square('ramp', 0, { floor: { z: 0, slope: [0.1, 0] }, ceiling: { z: 3, slope: [0, 0.05] } })
    expect(issues({ sectors: [ramp] })).toEqual([
      {
        path: ['sectors', 0, 'floor', 'slope'],
        code: 'sloped-floor',
        message: 'ramp: the floor slopes, which the sim cannot walk yet',
        where: 'ramp',
      },
      {
        path: ['sectors', 0, 'ceiling', 'slope'],
        code: 'sloped-ceiling',
        message: 'ramp: the ceiling slopes, which the sim cannot read yet',
        where: 'ramp',
      },
    ])
    expect(issues({ sectors: [square('flat', 0, { floor: { z: 0, slope: [0, 0] } })] })).toEqual([])
  })

  it('reports every fault in the file, without throwing', () => {
    const bad = square('a', 0, {
      corners: [
        [0, 0, { next: 'nowhere' }],
        [2, 2],
        [2, 0],
        [0, 2],
      ],
    })
    expect(issues({ sectors: [bad] }).map((problem) => problem.code)).toEqual([
      'wall-crossing',
      'unknown-portal',
    ])
  })
})
