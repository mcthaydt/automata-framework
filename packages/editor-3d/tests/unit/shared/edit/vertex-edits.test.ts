// The vertex edits (ED3D.6d): `sector.addCorner`, which splits a wall at a point and splits a portal's reverse with it, and
// `sector.removeCorner`, which joins the two walls at a corner into one. On the depot (the hall from (0, 0) to (8, 6): a
// window on its north wall, a portal east into the dock, a door on its west wall) and on small levels that show one rule
// each.

import type { AfSector, AfSectorEntry, WallDef } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import type { Edit } from '#src/shared/edit/edit.ts'
import { type Changes, cornerInserted, insertCorner, removeCorner } from '#src/shared/edit/vertex-edits.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import type { EditSector } from '#src/shared/level-session/sector-access.ts'
import { levelOf, must, reasonOf } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

const depot = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const afOn = (level: AfSector, edit: Edit<AfSector>) => edit.run(afSectorProfile, level)
const sector = (level: AfSector, id: string): EditSector =>
  must(afSectorProfile.sectors.list(level).find((each) => each.id === id))
const openings = (level: AfSector) => must(afSectorProfile.checks(level).find((r) => r.id === 'openings'))

/** One room a, (0, 0) to (8, 6), whose north wall (corner 0, from (0, 0) to (8, 0), 8 m) is `wall`. */
const room = (wall?: WallDef): AfSector =>
  toyAfSector({
    sectors: [
      {
        id: 'a',
        floor: 0,
        ceiling: 4,
        light: 1,
        corners: [wall === undefined ? [0, 0] : [0, 0, wall], [8, 0], [8, 6], [0, 6]],
      },
    ],
  })

/** The first and second half of a's north wall after a corner at (x, 0). */
const halves = (level: AfSector, x: number): readonly [unknown, unknown] => {
  const { corners } = sector(levelOf(afOn(level, insertCorner({ sector: 'a', corner: 0, x, z: 0 }))), 'a')
  return [corners[0]?.[2], corners[1]?.[2]]
}

describe('insertCorner on a solid wall', () => {
  it('puts a corner on the hall’s south wall, in order, and selects the two walls it made', () => {
    const result = afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: 3, z: 6 }))
    expect(sector(levelOf(result), 'hall').corners).toEqual([
      [0, 0, { window: { at: 4, width: 1.6, y0: 1, y1: 2.6 } }],
      [8, 0, { next: 'dock' }],
      [8, 6],
      [3, 6],
      [0, 6, { door: { at: 3, width: 1.2, height: 2.2 } }],
    ])
    expect(result.ok && result.select).toEqual(['wall:hall/2', 'wall:hall/3'])
  })

  it('splits a wall of a sector whose id a selection cannot hold, and selects nothing', () => {
    const level = toyAfSector({
      sectors: [
        {
          id: 'north/hall',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
          ],
        },
      ],
    })
    const result = afOn(level, insertCorner({ sector: 'north/hall', corner: 0, x: 2, z: 0 }))
    expect(sector(levelOf(result), 'north/hall').corners).toHaveLength(5)
    expect(result.ok && result.select).toBeUndefined()
  })

  it('changes nothing else in the level', () => {
    const next = levelOf(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: 3, z: 6 })))
    expect(sector(next, 'dock')).toBe(sector(depot, 'dock'))
    expect(next.entities).toBe(depot.entities)
  })

  it('counts the corner after the last one: a corner on the wall that closes the loop goes at the end', () => {
    const next = levelOf(afOn(depot, insertCorner({ sector: 'hall', corner: 3, x: 0, z: 2 })))
    expect(sector(next, 'hall').corners.map(([x, z]) => [x, z])).toEqual([
      [0, 0],
      [8, 0],
      [8, 6],
      [0, 6],
      [0, 2],
    ])
  })

  it('is labelled for the wall', () => {
    expect(insertCorner({ sector: 'hall', corner: 2, x: 3, z: 6 })).toMatchObject({
      id: 'sector.addCorner',
      label: 'Add a corner to wall 2 of hall',
    })
  })

  it('rounds to four decimals, and puts a point a few tenths of a millimetre off the line on it', () => {
    const next = levelOf(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: 3.123456, z: 6.0005 })))
    expect(sector(next, 'hall').corners[3]).toEqual([3.1235, 6])
  })

  it('puts a point on a diagonal wall on the line', () => {
    const diagonal = toyAfSector({
      sectors: [
        {
          id: 'a',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [4, 4],
            [0, 4],
          ],
        },
      ],
    })
    const next = levelOf(afOn(diagonal, insertCorner({ sector: 'a', corner: 0, x: 2, z: 2.0004 })))
    expect(sector(next, 'a').corners[1]?.slice(0, 2)).toEqual([2.0002, 2.0002])
  })

  it('refuses a point that is an end of the wall, as the wall’s own corner, and says so', () => {
    expect(reasonOf(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: 8, z: 6 })))).toBe(
      'that point is already a corner',
    )
    expect(reasonOf(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: 0.00004, z: 6 })))).toBe(
      'that point is already a corner',
    )
  })

  it('refuses a point more than a millimetre off the wall, or past its end', () => {
    expect(reasonOf(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: 3, z: 6.002 })))).toBe(
      'that point is not on wall 2 of hall',
    )
    expect(reasonOf(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: 9, z: 6 })))).toBe(
      'that point is not on wall 2 of hall',
    )
    expect(reasonOf(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: -1, z: 6 })))).toBe(
      'that point is not on wall 2 of hall',
    )
    // Within a millimetre of the segment is on it: 0.9 mm off.
    expect(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: 3, z: 6.0009 })).ok).toBe(true)
  })

  it('refuses a sector that is not there, a wall that is not, and a point that is not a number', () => {
    expect(reasonOf(afOn(depot, insertCorner({ sector: 'nope', corner: 0, x: 1, z: 0 })))).toBe(
      'no sector nope',
    )
    for (const corner of [4, -1, 1.5])
      expect(reasonOf(afOn(depot, insertCorner({ sector: 'hall', corner, x: 1, z: 0 })))).toBe(
        `sector hall has no wall ${corner}`,
      )
    expect(reasonOf(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: Number.NaN, z: 6 })))).toBe(
      'the point must be two numbers',
    )
    expect(
      reasonOf(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: 3, z: Number.POSITIVE_INFINITY }))),
    ).toBe('the point must be two numbers')
  })

  it('answers a wall with no length that its point is already a corner', () => {
    const level = toyAfSector({
      sectors: [
        {
          id: 'a',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [0, 0],
            [4, 0],
            [4, 4],
          ],
        },
      ],
    })
    expect(reasonOf(afOn(level, insertCorner({ sector: 'a', corner: 0, x: 0, z: 0 })))).toBe(
      'that point is already a corner',
    )
    expect(reasonOf(afOn(level, insertCorner({ sector: 'a', corner: 0, x: 1, z: 1 })))).toBe(
      'that point is not on wall 0 of a',
    )
  })

  it('copies every member of a wall to both halves', () => {
    const wall = { texture: 'brick', handrail: 0.9, thick: 0.2, occlude: 'never', trim: { rail: 1 } } as const
    expect(halves(room(wall), 3)).toEqual([wall, wall])
  })

  it('a wall with nothing to say gives two walls with nothing to say', () => {
    expect(halves(room(), 3)).toEqual([undefined, undefined])
  })
})

describe('insertCorner and the things set into a wall', () => {
  const door = (at: number) => ({ door: { at, width: 1, height: 2 } })
  const win = (at: number) => ({ window: { at, width: 1, y0: 1, y1: 2 } })

  it('keeps a door that lies wholly on the first half where it is', () => {
    expect(halves(room(door(2)), 4)).toEqual([door(2), undefined])
  })

  it('gives a door that lies wholly on the second half a place measured from the new corner', () => {
    expect(halves(room(door(6)), 4)).toEqual([undefined, door(2)])
  })

  it('counts a door that only touches the new corner as on the half it is on', () => {
    expect(halves(room(door(2)), 2.5)).toEqual([door(2), undefined])
    expect(halves(room(door(3)), 2.5)).toEqual([undefined, door(0.5)])
  })

  it('refuses a corner that would cut through the door', () => {
    expect(reasonOf(afOn(room(door(4)), insertCorner({ sector: 'a', corner: 0, x: 4, z: 0 })))).toBe(
      'the new corner would cut through the door',
    )
  })

  it('does the same for a window, and keeps a door and a window apart', () => {
    expect(halves(room(win(2)), 4)).toEqual([win(2), undefined])
    expect(halves(room(win(6)), 4)).toEqual([undefined, win(2)])
    expect(reasonOf(afOn(room(win(4)), insertCorner({ sector: 'a', corner: 0, x: 4, z: 0 })))).toBe(
      'the new corner would cut through the window',
    )
    const both = { ...door(1), ...win(6) }
    expect(halves(room(both), 4)).toEqual([door(1), win(2)])
  })

  it('measures a window by its whole width, from half of it either side of its centre', () => {
    const wide = { window: { at: 3, width: 2, y0: 1, y1: 2 } }
    expect(halves(room(wide), 4.5)).toEqual([wide, undefined])
    expect(halves(room(wide), 1.5)).toEqual([undefined, { window: { ...wide.window, at: 1.5 } }])
  })

  it('rounds the place of a hatch on the second half to four decimals', () => {
    const portal = { next: 'dock', hatch: [5.3333, 6.4444] } as const
    expect(halves(room(portal), 4.1111)).toEqual([
      { next: 'dock' },
      { next: 'dock', hatch: [1.2222, 2.3333] },
    ])
  })

  it('carries a member of a pilaster it does not know to both halves', () => {
    // A newer file may carry members this editor has no name for: the format keeps them, so the edit does.
    const pilaster = { start: [0.3, 0.2], end: [0.4, 0.2], tint: 'dark' } as const
    expect(halves(room({ pilaster } as WallDef), 4)).toEqual([
      { pilaster: { start: [0.3, 0.2], tint: 'dark' } },
      { pilaster: { end: [0.4, 0.2], tint: 'dark' } },
    ])
  })

  it('forgives the float noise in where a feature ends: a door that ends at the new corner is on the half it is on', () => {
    // 0.65 + 0.05 is 0.7000000000000001 and 0.85 - 0.05 is 0.7999999999999999.
    const narrow = (at: number) => ({ door: { at, width: 0.1, height: 2 } })
    expect(halves(room(narrow(0.65)), 0.7)).toEqual([narrow(0.65), undefined])
    expect(halves(room(narrow(0.85)), 0.8)).toEqual([undefined, narrow(0.05)])
  })

  it('refuses a corner that cuts a hatch written the other way round', () => {
    expect(
      reasonOf(afOn(room({ hatch: [5, 3] }), insertCorner({ sector: 'a', corner: 0, x: 4, z: 0 }))),
    ).toBe('the new corner would cut through the hatch')
  })

  it('rounds the place of a feature on the second half to four decimals', () => {
    expect(halves(room(door(6.3333)), 4.1111)).toEqual([undefined, door(2.2222)])
  })

  it('gives a pilaster’s start to the first half and its end to the second', () => {
    const pilaster = { start: [0.3, 0.2], end: [0.4, 0.2] } as const
    expect(halves(room({ pilaster }), 4)).toEqual([
      { pilaster: { start: [0.3, 0.2] } },
      { pilaster: { end: [0.4, 0.2] } },
    ])
    expect(halves(room({ pilaster: { start: [0.3, 0.2] } }), 4)).toEqual([
      { pilaster: { start: [0.3, 0.2] } },
      undefined,
    ])
    expect(halves(room({ pilaster: { end: [0.4, 0.2] } }), 4)).toEqual([
      undefined,
      { pilaster: { end: [0.4, 0.2] } },
    ])
  })

  it('keeps the other members of a wall that also has a door that moves', () => {
    expect(halves(room({ texture: 'brick', ...door(6) }), 4)).toEqual([
      { texture: 'brick' },
      { texture: 'brick', ...door(2) },
    ])
  })
})

describe('insertCorner on a portal', () => {
  /** Hall and dock as the depot has them, with `wall` and `reverse` as the two sides of the portal along x = 8. */
  const pair = (wall: WallDef, reverse: WallDef, dockLoop: 'same' | 'turned' = 'same'): AfSector => {
    const hall: AfSectorEntry = {
      id: 'hall',
      floor: 0,
      ceiling: 4,
      light: 1,
      corners: [
        [0, 0],
        [8, 0, wall],
        [8, 6],
        [0, 6],
      ],
    }
    const dock: AfSectorEntry = {
      id: 'dock',
      floor: -0.5,
      ceiling: 4,
      light: 0.7,
      corners:
        dockLoop === 'same'
          ? [
              [8, 0],
              [14, 0],
              [14, 6],
              [8, 6, reverse],
            ]
          : [
              [8, 6],
              [14, 6],
              [14, 0],
              [8, 0, reverse],
            ],
    }
    return toyAfSector({ sectors: [hall, dock] })
  }
  const split = (level: AfSector, z: number) =>
    levelOf(afOn(level, insertCorner({ sector: 'hall', corner: 1, x: 8, z })))

  it('splits the reverse wall in the same edit, at the same point', () => {
    const next = split(depot, 2)
    expect(sector(next, 'hall').corners.slice(1, 3)).toEqual([
      [8, 0, { next: 'dock' }],
      [8, 2, { next: 'dock' }],
    ])
    // The dock's wall runs from (8, 6) to (8, 0): its new corner is after the one that starts it, and the loop's end.
    expect(sector(next, 'dock').corners).toEqual([
      [8, 0],
      [14, 0],
      [14, 6],
      [8, 6, { next: 'hall' }],
      [8, 2, { next: 'hall' }],
    ])
  })

  it('keeps the pair matching, so the openings check still passes', () => {
    expect(openings(depot).ok).toBe(true)
    expect(openings(split(depot, 2)).ok).toBe(true)
  })

  it('does the same when the dock’s loop is written the other way round', () => {
    const level = pair({ next: 'dock' }, { next: 'hall' }, 'turned')
    expect(openings(level).ok).toBe(true)
    const next = split(level, 2)
    expect(sector(next, 'dock').corners).toEqual([
      [8, 6],
      [14, 6],
      [14, 0],
      [8, 0, { next: 'hall' }],
      [8, 2, { next: 'hall' }],
    ])
    expect(openings(next).ok).toBe(true)
  })

  it('puts the new corner after the corner that starts the reverse wall, wherever that is in its loop', () => {
    const level = toyAfSector({
      sectors: [
        {
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
        },
        {
          id: 'dock',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [8, 0, { next: 'hall' }],
            [8, 6],
            [14, 6],
            [14, 0],
          ],
        },
      ],
    })
    const next = split(level, 2)
    expect(sector(next, 'dock').corners.slice(0, 3)).toEqual([
      [8, 0, { next: 'hall' }],
      [8, 2, { next: 'hall' }],
      [8, 6],
    ])
  })

  it('divides a hatch on each side by the same rule, the reverse’s mirrored', () => {
    // Along the hall's wall from (8, 0) the hatch is 1 to 2 m; along the dock's, from (8, 6), it is 4 to 5 m.
    const level = pair(
      { next: 'dock', mask: 'bars', hatch: [1, 2] },
      { next: 'hall', mask: 'bars', hatch: [4, 5] },
    )
    const next = split(level, 4)
    expect(sector(next, 'hall').corners.slice(1, 3)).toEqual([
      [8, 0, { next: 'dock', mask: 'bars', hatch: [1, 2] }],
      [8, 4, { next: 'dock', mask: 'bars' }],
    ])
    expect(sector(next, 'dock').corners.slice(3)).toEqual([
      [8, 6, { next: 'hall', mask: 'bars' }],
      [8, 4, { next: 'hall', mask: 'bars', hatch: [2, 3] }],
    ])
  })

  it('refuses a hatch the new corner would cut, and names the sector whose wall it is on the other side', () => {
    const own = pair({ next: 'dock', mask: 'bars', hatch: [3, 5] }, { next: 'hall', mask: 'bars' })
    expect(reasonOf(afOn(own, insertCorner({ sector: 'hall', corner: 1, x: 8, z: 4 })))).toBe(
      'the new corner would cut through the hatch',
    )
    const other = pair({ next: 'dock', mask: 'bars' }, { next: 'hall', mask: 'bars', hatch: [1, 3] })
    // The dock's hatch is 1 to 3 m from (8, 6): 3 to 5 m from (8, 0), so a corner at (8, 4) is inside it.
    expect(reasonOf(afOn(other, insertCorner({ sector: 'hall', corner: 1, x: 8, z: 4 })))).toBe(
      'dock: the new corner would cut through the hatch',
    )
  })

  it('leaves a solid wall of the other sector over the same segment as it is', () => {
    const level = pair({ next: 'dock' }, { texture: 'brick' })
    const next = split(level, 2)
    expect(sector(next, 'dock')).toBe(sector(level, 'dock'))
    expect(sector(next, 'hall').corners.slice(1, 3)).toEqual([
      [8, 0, { next: 'dock' }],
      [8, 2, { next: 'dock' }],
    ])
  })

  it('splits a reverse wall that is on a hole of the other sector', () => {
    const level = toyAfSector({
      sectors: [
        {
          id: 'hall',
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
              [3, 3, { next: 'island' }],
              [7, 3],
              [7, 7],
              [3, 7],
            ],
          ],
        },
        {
          id: 'island',
          floor: 0.5,
          ceiling: 4,
          light: 1,
          corners: [
            [3, 3, { next: 'hall' }],
            [7, 3],
            [7, 7],
            [3, 7],
          ],
        },
      ],
    })
    const next = levelOf(afOn(level, insertCorner({ sector: 'island', corner: 0, x: 5, z: 3 })))
    expect(sector(next, 'island').corners.slice(0, 3)).toEqual([
      [3, 3, { next: 'hall' }],
      [5, 3, { next: 'hall' }],
      [7, 3],
    ])
    expect(sector(next, 'hall').holes).toEqual([
      [
        [3, 3, { next: 'island' }],
        [5, 3, { next: 'island' }],
        [7, 3],
        [7, 7],
        [3, 7],
      ],
    ])
    expect(sector(next, 'hall').corners).toEqual(sector(level, 'hall').corners)
  })

  it('splits a portal into a sector that is not there by itself', () => {
    const level = toyAfSector({
      sectors: [
        {
          id: 'a',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [4, 0, { next: 'gone' }],
            [4, 4],
            [0, 4],
          ],
        },
      ],
    })
    const next = levelOf(afOn(level, insertCorner({ sector: 'a', corner: 1, x: 4, z: 2 })))
    expect(sector(next, 'a').corners[2]).toEqual([4, 2, { next: 'gone' }])
  })

  it('splits a portal that has no reverse by itself', () => {
    const level = toyAfSector({
      sectors: [
        {
          id: 'a',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [4, 0, { next: 'b' }],
            [4, 4],
            [0, 4],
          ],
        },
        {
          id: 'b',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [10, 0],
            [14, 0],
            [14, 4],
            [10, 4],
          ],
        },
      ],
    })
    const next = levelOf(afOn(level, insertCorner({ sector: 'a', corner: 1, x: 4, z: 2 })))
    expect(sector(next, 'a').corners[2]).toEqual([4, 2, { next: 'b' }])
    expect(sector(next, 'b')).toBe(sector(level, 'b'))
  })
})

describe('removeCorner', () => {
  /** One room a with these corners and nothing else in the level. */
  const roomOf = (corners: AfSectorEntry['corners']): AfSector =>
    toyAfSector({ sectors: [{ id: 'a', floor: 0, ceiling: 4, light: 1, corners }] })
  const without = (level: AfSector, corner: number) => afOn(level, removeCorner({ sector: 'a', corner }))
  const cornersOf = (level: AfSector, corner: number) => sector(levelOf(without(level, corner)), 'a').corners

  /** The north wall of a is split at (4, 0): corner 0 starts the first half and corner 1 the second. */
  const split = (first: WallDef | undefined, second: WallDef | undefined): AfSector =>
    roomOf([
      first === undefined ? [0, 0] : [0, 0, first],
      second === undefined ? [4, 0] : [4, 0, second],
      [8, 0],
      [8, 6],
      [0, 6],
    ])
  const door = (at: number, width = 1) => ({ door: { at, width, height: 2 } })
  const win = (at: number, width = 1) => ({ window: { at, width, y0: 1, y1: 2 } })

  describe('joins the two walls at the corner', () => {
    it('into one that runs from the corner before to the corner after, and selects it', () => {
      const result = without(split(undefined, undefined), 1)
      expect(sector(levelOf(result), 'a').corners).toEqual([
        [0, 0],
        [8, 0],
        [8, 6],
        [0, 6],
      ])
      expect(result.ok && result.select).toEqual(['wall:a/0'])
    })

    it('is labelled for the corner', () => {
      expect(removeCorner({ sector: 'a', corner: 1 })).toMatchObject({
        id: 'sector.removeCorner',
        label: 'Remove corner 1 of a',
      })
    })

    it('cuts a corner off a room when the walls are not in line', () => {
      expect(cornersOf(split(undefined, undefined), 2)).toEqual([
        [0, 0],
        [4, 0],
        [8, 6],
        [0, 6],
      ])
    })

    it('writes what both walls say once, on the wall that starts at the corner before', () => {
      const brick = { texture: 'brick', handrail: 0.9, trim: { rail: 1 } }
      expect(sector(levelOf(without(split(brick, brick), 1)), 'a').corners[0]).toEqual([0, 0, brick])
    })

    it('counts round the loop: the first corner joins the last wall to the second', () => {
      const brick = { texture: 'brick' }
      const level = roomOf([
        [0, 0, brick],
        [4, 0, brick],
        [8, 0],
        [8, 6],
        [0, 6, brick],
      ])
      const result = without(level, 0)
      expect(sector(levelOf(result), 'a').corners).toEqual([
        [4, 0, brick],
        [8, 0],
        [8, 6],
        [0, 6, brick],
      ])
      // The joined wall starts at the old last corner, which is now the last but one... the fourth, index 3.
      expect(result.ok && result.select).toEqual(['wall:a/3'])
    })

    it('selects the joined wall whichever index it has once the corners have moved up', () => {
      const level = roomOf([
        [0, 0],
        [8, 0],
        [8, 6],
        [4, 6],
        [0, 6],
      ])
      const result = without(level, 3)
      expect(result.ok && result.select).toEqual(['wall:a/2'])
    })

    it('changes nothing else in the level', () => {
      const added = levelOf(afOn(depot, insertCorner({ sector: 'hall', corner: 2, x: 3, z: 6 })))
      const back = levelOf(afOn(added, removeCorner({ sector: 'hall', corner: 3 })))
      expect(sector(back, 'dock')).toBe(sector(added, 'dock'))
      expect(back.entities).toBe(depot.entities)
    })
  })

  describe('undoes insertCorner', () => {
    const roundTrip = (wall: WallDef | undefined, x: number): [AfSector, AfSector] => {
      const level = roomOf([wall === undefined ? [0, 0] : [0, 0, wall], [8, 0], [8, 6], [0, 6]])
      const added = levelOf(afOn(level, insertCorner({ sector: 'a', corner: 0, x, z: 0 })))
      return [level, levelOf(afOn(added, removeCorner({ sector: 'a', corner: 1 })))]
    }

    it('on the depot’s hall, wall by wall: the window, the solid wall and the door', () => {
      for (const corner of [0, 2, 3]) {
        const at = sector(depot, 'hall').corners
        const [from, to] = [at[corner] ?? [0, 0], at[(corner + 1) % at.length] ?? [0, 0]]
        // A quarter of the way along, where neither the window (at 4 of 8) nor the door (at 3 of 6) is.
        const [x, z] = [from[0] + (to[0] - from[0]) / 4, from[1] + (to[1] - from[1]) / 4]
        const added = levelOf(afOn(depot, insertCorner({ sector: 'hall', corner, x, z })))
        const back = levelOf(afOn(added, removeCorner({ sector: 'hall', corner: corner + 1 })))
        expect(back).toEqual(depot)
      }
    })

    it('on a wall with a texture, a trim and a handrail', () => {
      const [level, back] = roundTrip({ texture: 'brick', handrail: 0.9, trim: { rail: 1 }, thick: 0.2 }, 3)
      expect(back).toEqual(level)
    })

    it('on a wall with a door, whichever half it was on', () => {
      for (const at of [2, 6, 6.3333]) {
        const [level, back] = roundTrip(door(at), 4.1111)
        expect(back).toEqual(level)
      }
    })

    it('on a wall with a window and a pilaster', () => {
      const [level, back] = roundTrip(
        { ...win(6.4444), pilaster: { start: [0.3, 0.2], end: [0.4, 0.2] } },
        4.1111,
      )
      expect(back).toEqual(level)
    })
  })

  describe('wants the walls to agree', () => {
    it('on every member that is not a place along the wall, and names the ones that differ', () => {
      expect(reasonOf(without(split(undefined, { texture: 'brick' }), 1))).toBe(
        'the walls at corner 1 of a differ in texture: make them the same first',
      )
      expect(reasonOf(without(split({ texture: 'tile' }, { texture: 'brick' }), 1))).toBe(
        'the walls at corner 1 of a differ in texture: make them the same first',
      )
      expect(reasonOf(without(split({ trim: { rail: 1 } }, { trim: { rail: 2 } }), 1))).toBe(
        'the walls at corner 1 of a differ in trim: make them the same first',
      )
    })

    it('with the members in one order whichever wall comes first, and a list that reads', () => {
      const [one, two] = [{ texture: 'brick', handrail: 0.9 }, { thick: 0.3 }]
      const sentence =
        'the walls at corner 1 of a differ in handrail, texture and thick: make them the same first'
      expect(reasonOf(without(split(one, two), 1))).toBe(sentence)
      expect(reasonOf(without(split(two, one), 1))).toBe(sentence)
      expect(reasonOf(without(split({ texture: 'brick' }, { thick: 0.3 }), 1))).toBe(
        'the walls at corner 1 of a differ in texture and thick: make them the same first',
      )
    })

    it('and takes members that are alike, however deep, for the same', () => {
      const wall = { texture: 'brick', pan: [1, 2], trim: { rail: 1, cap: true } } as const
      expect(
        sector(levelOf(without(split(wall, { ...wall, trim: { cap: true, rail: 1 } }), 1)), 'a').corners[0],
      ).toEqual([0, 0, wall])
    })

    it('and tells a list, an object with more in it, and a null from what they are not', () => {
      const wall = (members: object) => members as WallDef
      expect(reasonOf(without(split(wall({ hideFrom: ['a'] }), wall({ hideFrom: ['a', 'b'] })), 1))).toBe(
        'the walls at corner 1 of a differ in hideFrom: make them the same first',
      )
      expect(reasonOf(without(split({ pan: [1, 2] }, { pan: [1, 3] }), 1))).toBe(
        'the walls at corner 1 of a differ in pan: make them the same first',
      )
      expect(reasonOf(without(split({ trim: { rail: 1 } }, { trim: { rail: 1, cap: true } }), 1))).toBe(
        'the walls at corner 1 of a differ in trim: make them the same first',
      )
      expect(reasonOf(without(split(wall({ tint: null }), wall({ tint: {} })), 1))).toBe(
        'the walls at corner 1 of a differ in tint: make them the same first',
      )
    })

    it('a door or a window does not count as a difference: it is joined on', () => {
      expect(sector(levelOf(without(split(door(2), undefined), 1)), 'a').corners[0]).toEqual([0, 0, door(2)])
    })
  })

  describe('and joins what is set into them', () => {
    it('a door on the first wall stays, one on the second moves on by the length of the first', () => {
      expect(cornersOf(split(door(2), undefined), 1)[0]).toEqual([0, 0, door(2)])
      expect(cornersOf(split(undefined, door(1)), 1)[0]).toEqual([0, 0, door(5)])
    })

    it('a window and a hatch too, to four decimals', () => {
      expect(cornersOf(split(undefined, win(1.2222)), 1)[0]).toEqual([0, 0, win(5.2222)])
      const portalLike = (hatch: [number, number]) => ({ hatch })
      expect(cornersOf(split(undefined, portalLike([1, 2])), 1)[0]).toEqual([0, 0, portalLike([5, 6])])
      expect(cornersOf(split(portalLike([1, 2]), undefined), 1)[0]).toEqual([0, 0, portalLike([1, 2])])
    })

    it('a hatch moves on by the length of the first wall, rounded to four decimals', () => {
      // 0.3333 + 4.1111 is 4.444400000000001 in floating point.
      const level = roomOf([
        [0, 0],
        [4.1111, 0, { hatch: [0.3333, 1.3333] }],
        [8, 0],
        [8, 6],
        [0, 6],
      ])
      expect(cornersOf(level, 1)[0]).toEqual([0, 0, { hatch: [4.4444, 5.4444] }])
    })

    it('a door on one wall and a window on the other are both kept', () => {
      expect(cornersOf(split(door(1), win(1)), 1)[0]).toEqual([0, 0, { ...door(1), ...win(5) }])
    })

    it('refuses a door on both walls, a window on both, and a hatch on both', () => {
      expect(reasonOf(without(split(door(1), door(1)), 1))).toBe('both walls have a door')
      expect(reasonOf(without(split(win(1), win(2)), 1))).toBe('both walls have a window')
      expect(reasonOf(without(split({ hatch: [1, 2] }, { hatch: [1, 2] }), 1))).toBe(
        'both walls have a hatch',
      )
    })

    it('a pilaster at the start of the first wall and one at the end of the second are both kept', () => {
      const start = { pilaster: { start: [0.3, 0.2] } } as const
      const end = { pilaster: { end: [0.4, 0.2] } } as const
      expect(cornersOf(split(start, end), 1)[0]).toEqual([
        0,
        0,
        { pilaster: { start: [0.3, 0.2], end: [0.4, 0.2] } },
      ])
      expect(cornersOf(split(start, undefined), 1)[0]).toEqual([0, 0, start])
      expect(cornersOf(split(undefined, end), 1)[0]).toEqual([0, 0, end])
    })

    it('refuses a pilaster that ends at the corner, from either wall', () => {
      expect(reasonOf(without(split({ pilaster: { end: [0.4, 0.2] } }, undefined), 1))).toBe(
        'a pilaster ends at corner 1',
      )
      expect(reasonOf(without(split(undefined, { pilaster: { start: [0.3, 0.2] } }), 1))).toBe(
        'a pilaster ends at corner 1',
      )
    })

    it('carries a member of a pilaster it does not know, from whichever wall has it', () => {
      const wall = (members: object) => members as WallDef
      const joinedWith = {
        pilaster: { start: [0.3, 0.2], end: [0.4, 0.2], tint: 'dark' },
      }
      expect(
        cornersOf(
          split(
            wall({ pilaster: { start: [0.3, 0.2], tint: 'dark' } }),
            wall({ pilaster: { end: [0.4, 0.2] } }),
          ),
          1,
        )[0],
      ).toEqual([0, 0, joinedWith])
      expect(
        cornersOf(
          split(
            wall({ pilaster: { start: [0.3, 0.2] } }),
            wall({ pilaster: { end: [0.4, 0.2], tint: 'dark' } }),
          ),
          1,
        )[0],
      ).toEqual([0, 0, joinedWith])
    })

    it('carries a member of a pilaster it does not know, in both', () => {
      const first = { pilaster: { start: [0.3, 0.2], tint: 'dark' } } as const
      const second = { pilaster: { end: [0.4, 0.2], tint: 'dark' } } as const
      expect(cornersOf(split(first as WallDef, second as WallDef), 1)[0]).toEqual([
        0,
        0,
        { pilaster: { start: [0.3, 0.2], end: [0.4, 0.2], tint: 'dark' } },
      ])
    })

    describe('when the new wall is shorter than the two', () => {
      // A dart: the corner at (10, 0) is a spike, and without it the first wall runs only to (1, 5), 5.1 m.
      const dart = (first: WallDef, second: WallDef): AfSector =>
        roomOf([
          [0, 0, first],
          [10, 0, second],
          [1, 5],
          [0, 10],
        ])

      it('keeps a door that still fits, and refuses one that does not, naming it', () => {
        expect(sector(levelOf(without(dart(door(2), {}), 1)), 'a').corners[0]).toEqual([0, 0, door(2)])
        expect(reasonOf(without(dart(door(8), {}), 1))).toBe('the joined wall is too short for its door')
      })

      it('does the same for a window, a hatch, and a feature moved on from the second wall', () => {
        expect(reasonOf(without(dart(win(8), {}), 1))).toBe('the joined wall is too short for its window')
        expect(reasonOf(without(dart({}, win(9)), 1))).toBe('the joined wall is too short for its window')
        expect(reasonOf(without(dart({}, door(1)), 1))).toBe('the joined wall is too short for its door')
        expect(reasonOf(without(dart({ hatch: [4, 6] }, {}), 1))).toBe(
          'the joined wall is too short for its hatch',
        )
      })

      it('refuses a feature that starts on the joined wall and ends past it, even by a millimetre', () => {
        expect(reasonOf(without(dart(door(5), {}), 1))).toBe('the joined wall is too short for its door')
        expect(reasonOf(without(dart(win(5), {}), 1))).toBe('the joined wall is too short for its window')
        // The dart's joined wall is 5.0990 m: a door 5.1 m wide centred on it is 1 mm too long.
        expect(reasonOf(without(dart(door(2.55, 5.1), {}), 1))).toBe(
          'the joined wall is too short for its door',
        )
      })

      it('a feature that ends at the end of a joined wall that is not in line fits it, to the rounding of its place', () => {
        // Two walls (0, 0) to (1, 2) to (2, 4) in line, each 2.23607 m. The door ends 0.00002 m before the end of the
        // second; its place moved on by the first wall's length is rounded up, which puts its end 0.00001 m past the end
        // of the joined wall: a rounding, not a door that is too long.
        const level = roomOf([
          [0, 0],
          [1, 2, door(1.1181, 2.2359)],
          [2, 4],
          [0, 4],
        ])
        expect(cornersOf(level, 1)[0]).toEqual([0, 0, door(3.3542, 2.2359)])
      })

      it('says a hatch written the other way round is too long when its far end is', () => {
        expect(reasonOf(without(dart({ hatch: [20, 3] }, {}), 1))).toBe(
          'the joined wall is too short for its hatch',
        )
      })

      it('a feature that ends where the joined wall does fits it', () => {
        // The dart's joined wall is (0, 0) to (1, 5): 5.0990 m. A door as wide as that ends on it, to rounding.
        const length = Math.hypot(1, 5)
        expect(without(dart(door(length / 2, length), {}), 1).ok).toBe(true)
      })
    })
  })

  describe('and refuses what it must', () => {
    it('a corner of a portal wall, from either side, naming the sector it leads into', () => {
      for (const corner of [1, 2])
        expect(reasonOf(afOn(depot, removeCorner({ sector: 'hall', corner })))).toBe(
          `the walls at corner ${corner} of hall lead into dock: make them solid first`,
        )
      expect(reasonOf(afOn(depot, removeCorner({ sector: 'dock', corner: 3 })))).toBe(
        'the walls at corner 3 of dock lead into hall: make them solid first',
      )
    })

    it('names a sector once when both walls lead into it', () => {
      const level = toyAfSector({
        sectors: [
          {
            id: 'a',
            floor: 0,
            ceiling: 4,
            light: 1,
            corners: [
              [0, 0],
              [8, 0, { next: 'dock' }],
              [8, 6, { next: 'dock' }],
              [0, 6],
            ],
          },
        ],
      })
      expect(reasonOf(without(level, 2))).toBe(
        'the walls at corner 2 of a lead into dock: make them solid first',
      )
    })

    it('names both sectors when the walls lead into two', () => {
      const level = toyAfSector({
        sectors: [
          {
            id: 'a',
            floor: 0,
            ceiling: 4,
            light: 1,
            corners: [
              [0, 0],
              [8, 0, { next: 'dock' }],
              [8, 6, { next: 'yard' }],
              [0, 6],
            ],
          },
        ],
      })
      expect(reasonOf(without(level, 2))).toBe(
        'the walls at corner 2 of a lead into dock and yard: make them solid first',
      )
    })

    it('a corner that would leave fewer than three, or an outline that crosses itself', () => {
      expect(
        reasonOf(
          without(
            roomOf([
              [0, 0],
              [4, 0],
              [0, 4],
            ]),
            1,
          ),
        ),
      ).toBe('a sector needs at least three corners')
      // The corner at (8, 0) taken from this dart would run its wall across the notch at (4, 3).
      expect(
        reasonOf(
          without(
            roomOf([
              [0, 0],
              [8, 0],
              [8, 8],
              [4, 3],
              [0, 8],
            ]),
            1,
          ),
        ),
      ).toBe('the outline crosses itself')
    })

    it('says the outline’s sentence before it says anything about the walls', () => {
      expect(
        reasonOf(
          without(
            roomOf([
              [0, 0, { texture: 'tile' }],
              [4, 0, { texture: 'brick' }],
              [0, 4],
            ]),
            1,
          ),
        ),
      ).toBe('a sector needs at least three corners')
    })

    it('a sector that is not there, and a corner that is not', () => {
      expect(reasonOf(afOn(depot, removeCorner({ sector: 'nope', corner: 0 })))).toBe('no sector nope')
      for (const corner of [4, -1, 1.5])
        expect(reasonOf(afOn(depot, removeCorner({ sector: 'hall', corner })))).toBe(
          `sector hall has no corner ${corner}`,
        )
    })

    it('a sector whose id a selection cannot hold: it joins the walls and selects nothing', () => {
      const level = toyAfSector({
        sectors: [
          {
            id: 'north/hall',
            floor: 0,
            ceiling: 4,
            light: 1,
            corners: [
              [0, 0],
              [4, 0],
              [8, 0],
              [8, 6],
              [0, 6],
            ],
          },
        ],
      })
      const result = afOn(level, removeCorner({ sector: 'north/hall', corner: 1 }))
      expect(sector(levelOf(result), 'north/hall').corners).toHaveLength(4)
      expect(result.ok && result.select).toBeUndefined()
    })
  })
})

describe('cornerInserted', () => {
  const insert = (changes: Changes, at: { sector: string; corner: number; x: number; z: number }) =>
    cornerInserted(afSectorProfile, depot, changes, at)
  const made = (result: Changes | string): Changes => {
    if (typeof result === 'string') throw new Error(`refused: ${result}`)
    return result
  }
  const cornersIn = (changes: Changes, id: string): readonly (readonly [number, number])[] =>
    must(changes.get(id)).corners.map(([x, z]) => [x, z])

  it('answers the sectors insertCorner would change: the sector, and the reverse of a portal wall', () => {
    expect([...made(insert(new Map(), { sector: 'hall', corner: 2, x: 3, z: 6 })).keys()]).toEqual(['hall'])
    expect([...made(insert(new Map(), { sector: 'hall', corner: 1, x: 8, z: 2 })).keys()]).toEqual([
      'hall',
      'dock',
    ])
  })

  it('makes the same sectors the edit does', () => {
    const changes = made(insert(new Map(), { sector: 'hall', corner: 1, x: 8, z: 2 }))
    const level = levelOf(afOn(depot, insertCorner({ sector: 'hall', corner: 1, x: 8, z: 2 })))
    expect(must(changes.get('hall'))).toEqual(sector(level, 'hall'))
    expect(must(changes.get('dock'))).toEqual(sector(level, 'dock'))
  })

  it('splits the sector it finds in the working set, not the level’s own: a second corner on the same wall', () => {
    const first = made(insert(new Map(), { sector: 'hall', corner: 2, x: 3, z: 6 }))
    // After the first corner the south wall runs (8, 6) to (3, 6); a corner on it at x = 5 is wall 2 again.
    const second = made(insert(first, { sector: 'hall', corner: 2, x: 5, z: 6 }))
    expect(cornersIn(second, 'hall')).toEqual([
      [0, 0],
      [8, 0],
      [8, 6],
      [5, 6],
      [3, 6],
      [0, 6],
    ])
  })

  it('splits the reverse it finds in the working set: two corners on one portal wall, the neighbour split twice', () => {
    const first = made(insert(new Map(), { sector: 'hall', corner: 1, x: 8, z: 2 }))
    const second = made(insert(first, { sector: 'hall', corner: 2, x: 8, z: 4 }))
    expect(cornersIn(second, 'hall')).toEqual([
      [0, 0],
      [8, 0],
      [8, 2],
      [8, 4],
      [8, 6],
      [0, 6],
    ])
    // The dock's west wall runs the other way, from (8, 6) up to (8, 0), and has a corner at each of the two.
    expect(cornersIn(second, 'dock')).toEqual([
      [8, 0],
      [14, 0],
      [14, 6],
      [8, 6],
      [8, 4],
      [8, 2],
    ])
  })

  it('does not change the working set it is given, and leaves the level’s sectors alone', () => {
    const before = new Map<string, EditSector>()
    made(insert(before, { sector: 'hall', corner: 2, x: 3, z: 6 }))
    expect(before.size).toBe(0)
    expect(depot.sectors[0]?.corners).toHaveLength(4)
  })

  it('answers the sentence insertCorner refuses with, and no map', () => {
    expect(insert(new Map(), { sector: 'nowhere', corner: 0, x: 0, z: 0 })).toBe('no sector nowhere')
    expect(insert(new Map(), { sector: 'hall', corner: 9, x: 0, z: 0 })).toBe('sector hall has no wall 9')
    expect(insert(new Map(), { sector: 'hall', corner: 2, x: 3, z: 5 })).toBe(
      'that point is not on wall 2 of hall',
    )
    expect(insert(new Map(), { sector: 'hall', corner: 2, x: 8, z: 6 })).toBe(
      'that point is already a corner',
    )
  })
})
