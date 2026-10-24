// The Split edit (ED3D.6e): `sector.split` cuts a sector in two along a line between two points of its outline. On the
// depot (the hall from (0, 0) to (8, 6): a window on its north wall from 3.2 to 4.8 m, a portal east into the dock, a door
// on its west wall), on small levels that show one rule each and on the Last Light clinic-dawn blockout.
import { describe, expect, it } from 'vitest'
import type { AfSector, AfSectorEntry } from '../format/af-sector.schema'
import type { Blockout } from '../format/blockout.schema'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightProfile } from '../profile/last-light-profile'
import { GeometryError, type LevelProfile } from '../profile/level-profile'
import type { EditCorner, EditSector } from '../profile/sector-access'
import { levelOf, reasonOf } from '../testing/edit-helpers'
import { loadAuthored, loadFixture } from '../testing/fixtures'
import { toyAfSector } from '../testing/toy-af-sector'
import { must } from '../testing/toy-blockout'
import { splitSector } from './split-edits'

const depot = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()
const dawn = (() => {
  const result = lastLightProfile.parse(loadFixture('blockout-clinic-dawn'))
  if (!result.ok) throw new Error('clinic-dawn does not parse')
  return result.value
})()

const cut = (sector: string, id: string, from: readonly [number, number], to: readonly [number, number]) =>
  splitSector<AfSector>({
    sector,
    id,
    from: { x: from[0], z: from[1] },
    to: { x: to[0], z: to[1] },
  })
const afSplit = (level: AfSector, ...args: Parameters<typeof cut>) => cut(...args).run(afSectorProfile, level)
const sector = (level: AfSector, id: string): EditSector =>
  must(afSectorProfile.sectors.list(level).find((each) => each.id === id))
const problems = (level: AfSector) =>
  afSectorProfile
    .checks(level)
    .filter((result) => !result.ok)
    .map((result) => result.id)
const openings = (level: AfSector) =>
  must(afSectorProfile.checks(level).find((result) => result.id === 'openings'))

/** A loop's corners from the one nearest the origin, so that two ways of writing one loop compare equal. */
const canonical = (corners: readonly EditCorner[]): readonly EditCorner[] => {
  const first = corners.reduce(
    (best, corner, i) =>
      corner[0] < (corners[best]?.[0] ?? 0) ||
      (corner[0] === corners[best]?.[0] && corner[1] < (corners[best]?.[1] ?? 0))
        ? i
        : best,
    0,
  )
  return [...corners.slice(first), ...corners.slice(0, first)]
}

describe('splitSector between two sides of the hall', () => {
  // x = 3 from the north wall (the window starts at 3.2) to the south wall: the hall keeps the larger east part.
  const result = afSplit(depot, 'hall', 'annex', [3, 0], [3, 6])
  const level = levelOf(result)

  it('makes two rooms of the hall: the larger half keeps the id, the smaller is the new sector, just after it', () => {
    expect(afSectorProfile.sectors.list(level).map((each) => each.id)).toEqual(['hall', 'annex', 'dock'])
    expect(sector(level, 'hall').corners).toEqual([
      [3, 0, { window: { at: 1, width: 1.6, y0: 1, y1: 2.6 } }],
      [8, 0, { next: 'dock' }],
      [8, 6],
      [3, 6, { next: 'annex' }],
    ])
    expect(sector(level, 'annex').corners).toEqual([
      [0, 0],
      [3, 0, { next: 'hall' }],
      [3, 6],
      [0, 6, { door: { at: 3, width: 1.2, height: 2.2 } }],
    ])
  })

  it('gives the new sector everything else the hall has', () => {
    const { corners: _hall, ...hall } = sector(depot, 'hall')
    const { corners: _annex, ...annex } = sector(level, 'annex')
    expect(annex).toEqual({ ...hall, id: 'annex' })
    const { corners: _kept, ...kept } = sector(level, 'hall')
    expect(kept).toEqual(hall)
  })

  it('turns the cut into a portal each way, so that the level is no worse for the checks', () => {
    expect(openings(level).ok).toBe(true)
    expect(problems(level)).toEqual(problems(depot))
  })

  it('selects the two rooms', () => {
    expect(result.ok && result.select).toEqual(['sector:hall', 'sector:annex'])
  })

  it('changes nothing else: the dock and the entities are the same objects', () => {
    expect(sector(level, 'dock')).toBe(sector(depot, 'dock'))
    expect(level.entities).toBe(depot.entities)
  })

  it('is labelled for the two rooms it makes', () => {
    expect(cut('hall', 'annex', [3, 0], [3, 6])).toMatchObject({
      id: 'sector.split',
      label: 'Split hall into hall and annex',
    })
  })
})

describe('splitSector keeps the larger half, and the half from the first point to the second on a tie', () => {
  it('keeps the id on the larger half whichever way round the points are given', () => {
    const forward = levelOf(afSplit(depot, 'hall', 'annex', [3, 0], [3, 6]))
    const backward = levelOf(afSplit(depot, 'hall', 'annex', [3, 6], [3, 0]))
    expect(canonical(sector(backward, 'hall').corners)).toEqual(canonical(sector(forward, 'hall').corners))
    expect(canonical(sector(backward, 'annex').corners)).toEqual(canonical(sector(forward, 'annex').corners))
  })

  it('keeps it on the half that runs from the first point to the second when both are the same size', () => {
    // The diagonal from (8, 0) to (0, 6): the triangle through (8, 6) and the triangle through (0, 0) are 24 m² each.
    const a = levelOf(afSplit(depot, 'hall', 'annex', [8, 0], [0, 6]))
    expect(sector(a, 'hall').corners.map(([x, z]) => [x, z])).toEqual([
      [8, 0],
      [8, 6],
      [0, 6],
    ])
    const b = levelOf(afSplit(depot, 'hall', 'annex', [0, 6], [8, 0]))
    expect(sector(b, 'hall').corners.map(([x, z]) => [x, z])).toEqual([
      [0, 0],
      [8, 0],
      [0, 6],
    ])
  })
})

describe('splitSector on halves that differ only by rounding', () => {
  it('keeps the id on the first point’s half, since the areas are the same to the last digit', () => {
    // Both triangles are 0.135 m², but the sums come out as 0.13499999999999934 and 0.1349999999999998.
    const slab = toyAfSector({
      sectors: [
        {
          id: 'slab',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [-3, -3],
            [-2.7, -3],
            [-2.7, -2.1],
            [-3, -2.1],
          ],
        },
      ],
    })
    const level = levelOf(afSplit(slab, 'slab', 'tip', [-2.7, -3], [-3, -2.1]))
    expect(sector(level, 'slab').corners).toEqual([
      [-2.7, -3],
      [-2.7, -2.1],
      [-3, -2.1, { next: 'tip' }],
    ])
  })
})

describe('splitSector between corners', () => {
  const result = afSplit(depot, 'hall', 'annex', [8, 0], [0, 6])
  const level = levelOf(result)

  it('makes no corner of its own when both ends are corners already', () => {
    expect(sector(level, 'hall').corners).toEqual([
      [8, 0, { next: 'dock' }],
      [8, 6],
      [0, 6, { next: 'annex' }],
    ])
    expect(sector(level, 'annex').corners).toEqual([
      [0, 0, { window: { at: 4, width: 1.6, y0: 1, y1: 2.6 } }],
      [8, 0, { next: 'hall' }],
      [0, 6, { door: { at: 3, width: 1.2, height: 2.2 } }],
    ])
  })

  it('leaves the dock’s wall alone, since the east wall stays with the hall', () => {
    expect(sector(level, 'dock')).toBe(sector(depot, 'dock'))
    expect(openings(level).ok).toBe(true)
  })

  it('takes a point within a millimetre of a corner for the corner', () => {
    const near = levelOf(afSplit(depot, 'hall', 'annex', [8.0004, 0.0003], [-0.0004, 6]))
    expect(near).toEqual(level)
  })
})

describe('splitSector from a corner to a place on a wall', () => {
  it('counts the corner after the new one when it comes later in the outline', () => {
    // From the north wall at (3, 0) to the corner (0, 6): the part east of the line is 39 m², the triangle 9 m².
    const level = levelOf(afSplit(depot, 'hall', 'corner', [3, 0], [0, 6]))
    expect(sector(level, 'hall').corners).toEqual([
      [3, 0, { window: { at: 1, width: 1.6, y0: 1, y1: 2.6 } }],
      [8, 0, { next: 'dock' }],
      [8, 6],
      [0, 6, { next: 'corner' }],
    ])
    expect(sector(level, 'corner').corners).toEqual([
      [0, 0],
      [3, 0, { next: 'hall' }],
      [0, 6, { door: { at: 3, width: 1.2, height: 2.2 } }],
    ])
    expect(openings(level).ok).toBe(true)
  })

  it('counts the corner as it is when it comes earlier, and sends the portal with the east wall to the new room', () => {
    // From the corner (8, 0) to the south wall at (5, 6): the triangle holds the east wall and is the smaller part.
    const level = levelOf(afSplit(depot, 'hall', 'corner', [8, 0], [5, 6]))
    expect(sector(level, 'hall').corners).toEqual([
      [0, 0, { window: { at: 4, width: 1.6, y0: 1, y1: 2.6 } }],
      [8, 0, { next: 'corner' }],
      [5, 6],
      [0, 6, { door: { at: 3, width: 1.2, height: 2.2 } }],
    ])
    expect(sector(level, 'corner').corners).toEqual([
      [8, 0, { next: 'dock' }],
      [8, 6],
      [5, 6, { next: 'hall' }],
    ])
    expect(sector(level, 'dock').corners[3]).toEqual([8, 6, { next: 'corner' }])
    expect(openings(level).ok).toBe(true)
  })
})

describe('splitSector on a sector written clockwise', () => {
  const clockwise = (corners: AfSectorEntry['corners']) =>
    toyAfSector({ sectors: [{ id: 'room', floor: 0, ceiling: 4, light: 1, corners }] })

  it('cuts it the same', () => {
    const level = levelOf(
      afSplit(
        clockwise([
          [0, 0],
          [0, 6],
          [8, 6],
          [8, 0],
        ]),
        'room',
        'west',
        [3, 0],
        [3, 6],
      ),
    )
    expect(sector(level, 'room').corners).toEqual([
      [3, 6],
      [8, 6],
      [8, 0],
      [3, 0, { next: 'west' }],
    ])
    expect(sector(level, 'west').corners).toEqual([
      [0, 0],
      [0, 6],
      [3, 6, { next: 'room' }],
      [3, 0],
    ])
  })

  it('still refuses a cut that leaves it', () => {
    const level = clockwise([
      [0, 0],
      [0, 8],
      [3, 8],
      [3, 3],
      [8, 3],
      [8, 0],
    ])
    expect(reasonOf(afSplit(level, 'room', 'tip', [3, 8], [8, 3]))).toBe('that cut does not stay inside room')
  })
})

describe('splitSector across a portal wall', () => {
  it('moves the portal to the new room and points the dock back at it when the cut leaves the east wall with the smaller half', () => {
    // x = 5: the window (3.2 to 4.8) stays west, the east part is the smaller one and takes the portal into the dock.
    const level = levelOf(afSplit(depot, 'hall', 'annex', [5, 0], [5, 6]))
    expect(sector(level, 'hall').corners).toEqual([
      [0, 0, { window: { at: 4, width: 1.6, y0: 1, y1: 2.6 } }],
      [5, 0, { next: 'annex' }],
      [5, 6],
      [0, 6, { door: { at: 3, width: 1.2, height: 2.2 } }],
    ])
    expect(sector(level, 'annex').corners).toEqual([
      [5, 0],
      [8, 0, { next: 'dock' }],
      [8, 6],
      [5, 6, { next: 'hall' }],
    ])
    // The dock’s west wall led into the hall and now leads into the annex, which owns the wall.
    expect(sector(level, 'dock').corners[3]).toEqual([8, 6, { next: 'annex' }])
    expect(openings(level).ok).toBe(true)
  })

  it('splits the portal wall and its reverse when the cut ends on it, and sends the half that moved to the new room', () => {
    // From the east wall at (8, 3) to the west wall at (0, 4): the north part (28 m²) keeps the hall.
    const level = levelOf(afSplit(depot, 'hall', 'annex', [8, 3], [0, 4]))
    expect(sector(level, 'hall').corners).toEqual([
      [0, 0, { window: { at: 4, width: 1.6, y0: 1, y1: 2.6 } }],
      [8, 0, { next: 'dock' }],
      [8, 3, { next: 'annex' }],
      [0, 4, { door: { at: 1, width: 1.2, height: 2.2 } }],
    ])
    expect(sector(level, 'annex').corners).toEqual([
      [8, 3, { next: 'dock' }],
      [8, 6],
      [0, 6],
      [0, 4, { next: 'hall' }],
    ])
    // The dock's west wall is two now: the upper half still leads into the hall, the lower into the annex.
    expect(sector(level, 'dock').corners.slice(3)).toEqual([
      [8, 6, { next: 'annex' }],
      [8, 3, { next: 'hall' }],
    ])
    expect(openings(level).ok).toBe(true)
    expect(problems(level)).toEqual(problems(depot))
  })
})

describe('splitSector refuses what it cannot do', () => {
  const reason = (...args: Parameters<typeof cut>) => reasonOf(afSplit(depot, ...args))

  it('names a sector that is not there', () => {
    expect(reason('nowhere', 'annex', [3, 0], [3, 6])).toBe('no sector nowhere')
  })

  it('refuses a new id that is not an id or is taken', () => {
    expect(reason('hall', '3rd', [3, 0], [3, 6])).toBe(
      'the sector id must be an id: a letter, then letters, digits, - or _',
    )
    expect(reason('hall', 'dock', [3, 0], [3, 6])).toBe('there is already a sector dock')
    expect(reason('hall', 'hall', [3, 0], [3, 6])).toBe('there is already a sector hall')
  })

  it('refuses a cut that is not two points', () => {
    expect(reason('hall', 'annex', [Number.NaN, 0], [3, 6])).toBe('the cut must be two points')
    expect(reason('hall', 'annex', [3, 0], [3, Number.POSITIVE_INFINITY])).toBe('the cut must be two points')
  })

  it('refuses a cut that starts and ends at one point', () => {
    expect(reason('hall', 'annex', [3, 0], [3.0004, 0])).toBe('the cut starts and ends at the same point')
  })

  it('refuses an end that is not on the outline, inside the room or outside it', () => {
    expect(reason('hall', 'annex', [3, 1], [3, 6])).toBe('that point is not on the outline of hall')
    expect(reason('hall', 'annex', [3, 0], [3, 7])).toBe('that point is not on the outline of hall')
    expect(reason('hall', 'annex', [3, 0], [4, 3])).toBe('that point is not on the outline of hall')
  })

  it('refuses a cut along a wall: two ends on one wall, or on neighbouring corners', () => {
    expect(reason('hall', 'annex', [1, 0], [6.5, 0])).toBe('the cut runs along a wall of hall')
    expect(reason('hall', 'annex', [0, 0], [8, 0])).toBe('the cut runs along a wall of hall')
    expect(reason('hall', 'annex', [8, 0], [8, 6])).toBe('the cut runs along a wall of hall')
    expect(reason('hall', 'annex', [0, 6], [0, 0])).toBe('the cut runs along a wall of hall')
  })

  it('refuses a corner that would cut through a window or a door, in the sentence of the vertex edits', () => {
    expect(reason('hall', 'annex', [4, 0], [4, 6])).toBe('the new corner would cut through the window')
    expect(reason('hall', 'annex', [8, 3], [0, 3])).toBe('the new corner would cut through the door')
  })

  it('refuses a level the engine cannot build, in the engine’s own sentence', () => {
    const unbuildable: LevelProfile<AfSector> = {
      ...afSectorProfile,
      geometry: () => {
        throw new GeometryError('the engine cannot build it')
      },
    }
    expect(reasonOf(cut('hall', 'annex', [3, 0], [3, 6]).run(unbuildable, depot))).toBe(
      'the engine cannot build it',
    )
  })

  it('makes no change on a refusal', () => {
    const edit = cut('hall', 'annex', [4, 0], [4, 6])
    expect(edit.run(afSectorProfile, depot).ok).toBe(false)
    expect(depot.sectors).toHaveLength(2)
  })
})

describe('splitSector on a bent sector', () => {
  /** An L: the arm along the north (0 to 8 by 0 to 3) and the arm down the west (0 to 3 by 0 to 8). */
  const ell = toyAfSector({
    sectors: [
      {
        id: 'ell',
        floor: 0,
        ceiling: 4,
        light: 1,
        corners: [
          [0, 0],
          [8, 0],
          [8, 3],
          [3, 3],
          [3, 8],
          [0, 8],
        ],
      },
    ],
  })

  it('cuts the elbow in two from corner to corner, the halves being 19.5 m² each, so the first point’s half keeps the id', () => {
    const level = levelOf(afSplit(ell, 'ell', 'tip', [3, 3], [0, 0]))
    expect(sector(level, 'ell').corners.map(([x, z]) => [x, z])).toEqual([
      [0, 0],
      [3, 3],
      [3, 8],
      [0, 8],
    ])
    expect(sector(level, 'tip').corners.map(([x, z]) => [x, z])).toEqual([
      [0, 0],
      [8, 0],
      [8, 3],
      [3, 3],
    ])
  })

  it('refuses a cut that leaves the sector, across the notch', () => {
    expect(reasonOf(afSplit(ell, 'ell', 'tip', [8, 3], [3, 8]))).toBe('that cut does not stay inside ell')
  })

  it('refuses the same cut written from the other end', () => {
    expect(reasonOf(afSplit(ell, 'ell', 'tip', [3, 8], [8, 3]))).toBe('that cut does not stay inside ell')
  })

  it('refuses a cut that goes out of a C and back in, though both halves have a positive area', () => {
    // From (0, 0) to (10, 6) it crosses the open middle of the C; the halves are 14 m² (a bow tie) and 30 m².
    const c = toyAfSector({
      sectors: [
        {
          id: 'c',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [10, 0],
            [10, 2],
            [2, 2],
            [2, 4],
            [10, 4],
            [10, 6],
            [0, 6],
          ],
        },
      ],
    })
    expect(reasonOf(afSplit(c, 'c', 'tip', [0, 0], [10, 6]))).toBe('that cut does not stay inside c')
    expect(reasonOf(afSplit(c, 'c', 'tip', [10, 6], [0, 0]))).toBe('that cut does not stay inside c')
  })

  it('refuses a cut that goes out and comes back in', () => {
    // From (8, 3) to (0, 8): it crosses the inner corner's walls.
    expect(reasonOf(afSplit(ell, 'ell', 'tip', [8, 3], [0, 8]))).toBe('that cut does not stay inside ell')
  })
})

describe('splitSector on a sector with a hole', () => {
  /** A plaza from (0, 0) to (10, 10) with a hole of one metre or two, whose lower left corner is at `at`. */
  const plazaWith = (hole: AfSectorEntry['corners'], more: readonly AfSectorEntry[] = []): AfSector =>
    toyAfSector({
      sectors: [
        {
          id: 'plaza',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
          ],
          holes: [hole],
        },
        ...more,
      ],
    })
  const middle: AfSectorEntry['corners'] = [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
  ]
  const far: AfSectorEntry['corners'] = [
    [8, 8],
    [9, 8],
    [9, 9],
    [8, 9],
  ]

  it('keeps the hole with the half that holds it', () => {
    const level = levelOf(afSplit(plazaWith(middle), 'plaza', 'strip', [2, 0], [2, 10]))
    expect(sector(level, 'plaza').holes).toEqual([middle])
    expect(sector(level, 'strip')).not.toHaveProperty('holes')
  })

  it('gives the hole to the new room when that is where it lies', () => {
    const level = levelOf(afSplit(plazaWith(far), 'plaza', 'rest', [7, 0], [7, 10]))
    expect(sector(level, 'plaza')).not.toHaveProperty('holes')
    expect(sector(level, 'rest').holes).toEqual([far])
  })

  it('refuses a cut through the hole', () => {
    expect(reasonOf(afSplit(plazaWith(middle), 'plaza', 'strip', [5, 0], [5, 10]))).toBe(
      'that cut crosses a hole of plaza',
    )
  })

  it('refuses a cut that touches a corner of the hole', () => {
    expect(reasonOf(afSplit(plazaWith(middle), 'plaza', 'strip', [0, 4], [10, 4]))).toBe(
      'that cut crosses a hole of plaza',
    )
  })

  it('points the room that stands in the hole at the new room along with the hole', () => {
    const island: AfSectorEntry = {
      id: 'island',
      floor: 0,
      ceiling: 4,
      light: 1,
      corners: [
        [8, 8],
        [8, 9],
        [9, 9],
        [9, 8, { next: 'plaza' }],
      ],
    }
    const level = levelOf(
      afSplit(
        plazaWith(
          [
            [8, 8, { next: 'island' }],
            [9, 8],
            [9, 9],
            [8, 9],
          ],
          [island],
        ),
        'plaza',
        'rest',
        [7, 0],
        [7, 10],
      ),
    )
    expect(sector(level, 'rest').holes?.[0]?.[0]).toEqual([8, 8, { next: 'island' }])
    expect(sector(level, 'island').corners[3]).toEqual([9, 8, { next: 'rest' }])
    expect(openings(level).ok).toBe(true)
  })
})

describe('splitSector refuses a sector that is tied to its walls, or leads into itself', () => {
  it('refuses a portal into itself', () => {
    const loop = toyAfSector({
      sectors: [
        {
          id: 'a',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0, { next: 'a' }],
            [8, 0],
            [8, 6],
            [0, 6],
          ],
        },
      ],
    })
    expect(reasonOf(afSplit(loop, 'a', 'b', [4, 0], [4, 6]))).toBe('a has a portal into itself')
  })

  it('refuses a portal into itself from a hole', () => {
    const loop = toyAfSector({
      sectors: [
        {
          id: 'a',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
          ],
          holes: [
            [
              [4, 4, { next: 'a' }],
              [6, 4],
              [6, 6],
              [4, 6],
            ],
          ],
        },
      ],
    })
    expect(reasonOf(afSplit(loop, 'a', 'b', [2, 0], [2, 10]))).toBe('a has a portal into itself')
  })

  it('names what is tied to a Last Light room’s walls, and points at the room', () => {
    const [first, second] = [must(dawn.hotspots[0]), must(dawn.hotspots[1])]
    const level: Blockout = {
      ...dawn,
      hotspots: [
        { ...first, on: 'wall:ward/3' },
        { ...second, on: 'wall:ward/1' },
        ...dawn.hotspots.slice(2),
      ],
    }
    const result = splitSector<Blockout>({
      sector: 'ward',
      id: 'wardWest',
      from: { x: -3.4, z: -3.8 },
      to: { x: -3.4, z: -0.875 },
    }).run(lastLightProfile, level)
    expect(result).toEqual({
      ok: false,
      reason:
        'ward cannot be cut while something is tied to its walls: hotspots.0.on: wall:ward/3; hotspots.1.on: wall:ward/1',
      at: 'sector:ward',
    })
  })

  it('refuses a Last Light room that an opening joins', () => {
    const result = splitSector<Blockout>({
      sector: 'yard',
      id: 'yardEast',
      from: { x: 2, z: -10 },
      to: { x: 2, z: -7 },
    }).run(lastLightProfile, dawn)
    expect(reasonOf(result)).toBe(
      'yard cannot be cut while something is tied to its walls: opening exitWay (corridor → yard)',
    )
  })
})

describe('splitSector in Last Light', () => {
  const split = splitSector<Blockout>({
    sector: 'ward',
    id: 'wardWest',
    from: { x: -3.4, z: -3.8 },
    to: { x: -3.4, z: -0.875 },
  })
  const result = split.run(lastLightProfile, dawn)
  const level = levelOf(result)
  const room = (id: string) => must(lastLightProfile.sectors.list(level).find((each) => each.id === id))

  it('cuts the ward in two: the east half keeps the name, the west half is the new room, with the zone and the rest', () => {
    expect(room('ward').corners).toEqual([
      [-3.4, -3.8, { cut: 'ward-back' }],
      [-1.9, -3.8, { cut: 'ward-east', thick: 0.2125 }],
      [-1.9, -0.875, { next: 'hall' }],
      [-3.4, -0.875, { next: 'wardWest' }],
    ])
    expect(room('wardWest').corners).toEqual([
      [
        -4.875,
        -3.8,
        {
          cut: 'ward-back',
          window: {
            at: 0.875,
            width: 0.7,
            y0: 3.05,
            y1: 3.75,
            bars: 4,
            moon: true,
          },
        },
      ],
      [-3.4, -3.8, { next: 'ward' }],
      [-3.4, -0.875, { next: 'hall' }],
      [-4.875, -0.875, 'west'],
    ])
    expect(room('ward')).toMatchObject({
      zone: 'hall',
      light: 1.2,
      open: true,
      ceiling: 4.9,
    })
    expect(room('wardWest')).toMatchObject({
      zone: 'hall',
      light: 1.2,
      open: true,
      ceiling: 4.9,
    })
  })

  it('splits the hall’s wall into the ward, and sends the west half to the new room', () => {
    const hall = room('hall').corners
    expect(hall[12]).toEqual([-4.875, -0.875, { next: 'wardWest' }])
    expect(hall[13]).toEqual([-3.4, -0.875, { next: 'ward' }])
    expect(hall[14]).toEqual([-1.9, -0.875, { preset: 'PILASTER', cut: 'north-west' }])
    expect(lastLightProfile.checks(level).find((r) => r.id === 'openings')?.ok).toBe(true)
  })

  it('selects both rooms, and leaves the other rooms the same objects', () => {
    expect(result.ok && result.select).toEqual(['sector:ward', 'sector:wardWest'])
    expect(room('corridor')).toBe(must(dawn.rooms.find((each) => each.id === 'corridor')))
  })

  it('refuses a wall preset that leads into the room, whose walls are tied to it', () => {
    const through: Blockout = {
      ...dawn,
      walls: { ...dawn.walls, TOWARD: { next: 'ward' } },
      rooms: dawn.rooms.map((each) =>
        each.id === 'hall'
          ? {
              ...each,
              corners: each.corners.map((corner, i) =>
                i === 12 ? ([corner[0], corner[1], { preset: 'TOWARD' }] as typeof corner) : corner,
              ),
            }
          : each,
      ),
    }
    expect(reasonOf(split.run(lastLightProfile, through))).toBe(
      'ward cannot be cut while something is tied to its walls: wall preset TOWARD: next ward',
    )
  })
})
