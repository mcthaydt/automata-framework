// The vertex edits (ED3D.6d): `sector.addCorner`, which splits a wall at a point and splits a portal's reverse with it, and
// `sector.removeCorner`, which joins the two walls at a corner into one. On the depot (the hall from (0, 0) to (8, 6): a
// window on its north wall, a portal east into the dock, a door on its west wall), on small levels that show one rule each
// and on the Last Light clinic-dawn blockout.
import { describe, expect, it } from 'vitest'
import type { AfSector, AfSectorEntry } from '../format/af-sector.schema'
import type { WallDef } from '../format/sector.schema'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightProfile } from '../profile/last-light-profile'
import type { EditSector } from '../profile/sector-access'
import { levelOf, reasonOf } from '../testing/edit-helpers'
import { loadAuthored, loadFixture } from '../testing/fixtures'
import { toyAfSector } from '../testing/toy-af-sector'
import { must } from '../testing/toy-blockout'
import type { Edit } from './edit'
import { insertCorner } from './vertex-edits'

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

describe('insertCorner in Last Light', () => {
  const room = (level: typeof dawn, id: string): EditSector =>
    must(lastLightProfile.sectors.list(level).find((each) => each.id === id))

  it('copies a cutaway name to both halves', () => {
    const before = room(dawn, 'hall').corners
    expect(before[5]).toEqual([4.875, -0.875, 'east'])
    const next = levelOf(
      insertCorner<typeof dawn>({ sector: 'hall', corner: 5, x: 4.875, z: 2 }).run(lastLightProfile, dawn),
    )
    expect(room(next, 'hall').corners.slice(5, 7)).toEqual([
      [4.875, -0.875, 'east'],
      [4.875, 2, 'east'],
    ])
  })

  it('splits a portal and its reverse', () => {
    const next = levelOf(
      insertCorner<typeof dawn>({ sector: 'hall', corner: 12, x: -3, z: -0.875 }).run(lastLightProfile, dawn),
    )
    expect(room(next, 'hall').corners.slice(12, 14)).toEqual([
      [-4.875, -0.875, { next: 'ward' }],
      [-3, -0.875, { next: 'ward' }],
    ])
    expect(room(next, 'ward').corners.slice(2, 5)).toEqual([
      [-1.9, -0.875, { next: 'hall' }],
      [-3, -0.875, { next: 'hall' }],
      [-4.875, -0.875, 'west'],
    ])
    const portals = lastLightProfile.checks(next).find((result) => result.id === 'openings')
    expect(portals?.ok).toBe(true)
  })
})
