// The Merge edit (ED3D.6e): `sector.merge` takes one sector into another that shares a stretch of wall with it. The
// strongest test of the two edits is that they undo each other, so most cases below split a sector on the depot and
// merge the halves again, and smaller levels show the one rule each.

import type { AfSector, AfSectorEntry } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { afSectorProfile } from '../profile/af-sector-profile'
import { GeometryError, type LevelProfile } from '../profile/level-profile'
import type { EditCorner, EditSector } from '../profile/sector-access'
import { levelOf, must, reasonOf } from '../testing/edit-helpers'
import { loadAuthored } from '../testing/fixtures'
import { toyAfSector } from '../testing/toy-af-sector'
import { mergeSectors } from './merge-edits'
import { splitSector } from './split-edits'

const depot = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const afMerge = (level: AfSector, keep: string, merge: string) =>
  mergeSectors<AfSector>({ keep, merge }).run(afSectorProfile, level)
const afCut = (
  level: AfSector,
  sector: string,
  id: string,
  from: readonly [number, number],
  to: readonly [number, number],
) =>
  levelOf(
    splitSector<AfSector>({ sector, id, from: { x: from[0], z: from[1] }, to: { x: to[0], z: to[1] } }).run(
      afSectorProfile,
      level,
    ),
  )
const sector = (level: AfSector, id: string): EditSector =>
  must(afSectorProfile.sectors.list(level).find((each) => each.id === id))
const ids = (level: AfSector) => afSectorProfile.sectors.list(level).map((each) => each.id)
const problems = (level: AfSector) =>
  afSectorProfile
    .checks(level)
    .filter((result) => !result.ok)
    .map((result) => result.id)

/** A loop's corners from the one nearest the origin, so that two ways of writing one loop compare equal. */
const canonical = (corners: readonly EditCorner[]): readonly EditCorner[] => {
  let first = 0
  for (const [i, corner] of corners.entries()) {
    const best = must(corners[first])
    if (corner[0] < best[0] || (corner[0] === best[0] && corner[1] < best[1])) first = i
  }
  return [...corners.slice(first), ...corners.slice(0, first)]
}
/** A sector with its outline written from the corner nearest the origin. */
const steady = (each: EditSector): EditSector => ({ ...each, corners: canonical(each.corners) })

const room = (
  id: string,
  corners: AfSectorEntry['corners'],
  more: Partial<AfSectorEntry> = {},
): AfSectorEntry => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners,
  ...more,
})
const levelOfRooms = (...rooms: AfSectorEntry[]): AfSector => toyAfSector({ sectors: rooms })

describe('mergeSectors after a split on the depot', () => {
  it('puts the hall back as it was when its halves are merged, up to where the outline starts', () => {
    const level = levelOf(afMerge(afCut(depot, 'hall', 'annex', [3, 0], [3, 6]), 'hall', 'annex'))
    expect(ids(level)).toEqual(['hall', 'dock'])
    expect(steady(sector(level, 'hall'))).toEqual(sector(depot, 'hall'))
    expect(sector(level, 'dock')).toBe(sector(depot, 'dock'))
    expect(problems(level)).toEqual(problems(depot))
  })

  it('writes the outline from the first corner of the kept sector that is still a corner', () => {
    const level = levelOf(afMerge(afCut(depot, 'hall', 'annex', [3, 0], [3, 6]), 'hall', 'annex'))
    // The kept east half began at (3, 0), a corner the merge takes away.
    expect(sector(level, 'hall').corners).toEqual([
      [8, 0, { next: 'dock' }],
      [8, 6],
      [0, 6, { door: { at: 3, width: 1.2, height: 2.2 } }],
      [0, 0, { window: { at: 4, width: 1.6, y0: 1, y1: 2.6 } }],
    ])
  })

  it('points the dock back at the hall when the half that held the portal is the one that goes', () => {
    const split = afCut(depot, 'hall', 'annex', [5, 0], [5, 6])
    expect(sector(split, 'dock').corners[3]).toEqual([8, 6, { next: 'annex' }])
    const level = levelOf(afMerge(split, 'hall', 'annex'))
    expect(sector(level, 'dock')).toEqual(sector(depot, 'dock'))
    expect(steady(sector(level, 'hall'))).toEqual(sector(depot, 'hall'))
  })

  it('gives the level back whole when the cut ran through a portal wall and a wall with a door', () => {
    // From (0, 1) on the west wall (the door is further along) to (8, 1) on the east wall, which the dock’s wall mirrors.
    const split = afCut(depot, 'hall', 'annex', [0, 1], [8, 1])
    expect(sector(split, 'dock').corners).toHaveLength(5)
    const level = levelOf(afMerge(split, 'hall', 'annex'))
    expect(steady(sector(level, 'hall'))).toEqual(sector(depot, 'hall'))
    expect(sector(level, 'dock')).toEqual(sector(depot, 'dock'))
    expect(level.entities).toBe(depot.entities)
    expect(problems(level)).toEqual(problems(depot))
  })

  it('merges the other way round too: the new half keeps the id and takes the old one in', () => {
    const level = levelOf(afMerge(afCut(depot, 'hall', 'annex', [3, 0], [3, 6]), 'annex', 'hall'))
    expect(ids(level)).toEqual(['annex', 'dock'])
    expect(steady(sector(level, 'annex'))).toEqual({ ...sector(depot, 'hall'), id: 'annex' })
    expect(sector(level, 'dock').corners[3]).toEqual([8, 6, { next: 'annex' }])
  })

  it('selects the kept sector and is labelled for the two', () => {
    const split = afCut(depot, 'hall', 'annex', [3, 0], [3, 6])
    const edit = mergeSectors<AfSector>({ keep: 'hall', merge: 'annex' })
    expect(edit).toMatchObject({ id: 'sector.merge', label: 'Merge annex into hall' })
    const result = edit.run(afSectorProfile, split)
    expect(result.ok && result.select).toEqual(['sector:hall'])
  })
})

describe('mergeSectors with a neighbour', () => {
  it('fills a notch: three shared walls are one stretch, and the corners it leaves in line go', () => {
    const c = room('c', [
      [0, 0],
      [10, 0],
      [10, 2],
      [2, 2],
      [2, 4],
      [10, 4],
      [10, 6],
      [0, 6],
    ])
    const bar = room('bar', [
      [2, 2],
      [10, 2],
      [10, 4],
      [2, 4],
    ])
    const level = levelOf(afMerge(levelOfRooms(c, bar), 'c', 'bar'))
    expect(ids(level)).toEqual(['c'])
    expect(sector(level, 'c').corners).toEqual([
      [0, 0],
      [10, 0],
      [10, 6],
      [0, 6],
    ])
  })

  it('fills a notch whose shared walls run past the end of the outline', () => {
    // The same C written from the middle of its notch, so that the three shared walls are the last two and the first.
    const c = room('c', [
      [2, 4],
      [10, 4],
      [10, 6],
      [0, 6],
      [0, 0],
      [10, 0],
      [10, 2],
      [2, 2],
    ])
    const bar = room('bar', [
      [2, 2],
      [10, 2],
      [10, 4],
      [2, 4],
    ])
    const level = levelOf(afMerge(levelOfRooms(c, bar), 'c', 'bar'))
    expect(sector(level, 'c').corners).toEqual([
      [10, 6],
      [0, 6],
      [0, 0],
      [10, 0],
    ])
  })

  it('turns a neighbour written the other way round, and a door on its wall keeps its place', () => {
    // The left room runs counter-clockwise, the right one clockwise with a door 1 m along its north wall (from (4, 4)).
    const left = room('left', [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ])
    const right = room('right', [
      [4, 0],
      [4, 4, { door: { at: 1, width: 1, height: 2 } }],
      [8, 4],
      [8, 0],
    ])
    const level = levelOf(afMerge(levelOfRooms(left, right), 'left', 'right'))
    // The door stood 1 m east of (4, 4), which is 3 m from the north-east corner (8, 4), where the new wall starts.
    expect(sector(level, 'left').corners).toEqual([
      [0, 0],
      [8, 0],
      [8, 4, { door: { at: 3, width: 1, height: 2 } }],
      [0, 4],
    ])
  })

  it('points every wall that led into the sector that goes at the one that stays', () => {
    const a = room('a', [
      [0, 0],
      [4, 0, { next: 'mid' }],
      [4, 4],
      [0, 4],
    ])
    const mid = room('mid', [
      [4, 0],
      [8, 0, { next: 'b' }],
      [8, 4],
      [4, 4, { next: 'a' }],
    ])
    const b = room('b', [
      [8, 0],
      [12, 0],
      [12, 4],
      [8, 4, { next: 'mid', frame: true, thick: 0.3 }],
    ])
    const level = levelOf(afMerge(levelOfRooms(a, mid, b), 'a', 'mid'))
    expect(ids(level)).toEqual(['a', 'b'])
    expect(sector(level, 'a').corners).toEqual([
      [0, 0],
      [8, 0, { next: 'b' }],
      [8, 4],
      [0, 4],
    ])
    expect(sector(level, 'b').corners[3]).toEqual([8, 4, { next: 'a', frame: true, thick: 0.3 }])
    expect(afSectorProfile.checks(level).find((each) => each.id === 'openings')?.ok).toBe(true)
  })

  it('keeps the first sector’s members and drops the second’s', () => {
    const a = room(
      'a',
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ],
      { light: 0.8, ceilingTexture: 'plaster', wallTexture: 'brick' },
    )
    const b = room(
      'b',
      [
        [4, 0],
        [8, 0],
        [8, 4],
        [4, 4],
      ],
      { light: 0.3, view: 'tower', floorTexture: 'tile' },
    )
    const kept = sector(levelOf(afMerge(levelOfRooms(a, b), 'a', 'b')), 'a')
    const { corners: _corners, ...members } = kept
    expect(members).toEqual({
      id: 'a',
      floor: 0,
      ceiling: 4,
      light: 0.8,
      ceilingTexture: 'plaster',
      wallTexture: 'brick',
    })
  })

  it('carries the holes of both sectors', () => {
    const left = room(
      'left',
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      {
        holes: [
          [
            [2, 2],
            [3, 2],
            [3, 3],
            [2, 3],
          ],
        ],
      },
    )
    const right = room(
      'right',
      [
        [10, 0],
        [20, 0],
        [20, 10],
        [10, 10],
      ],
      {
        holes: [
          [
            [14, 4],
            [16, 4],
            [16, 6],
            [14, 6],
          ],
        ],
      },
    )
    const merged = sector(levelOf(afMerge(levelOfRooms(left, right), 'left', 'right')), 'left')
    expect(merged.corners).toEqual([
      [0, 0],
      [20, 0],
      [20, 10],
      [0, 10],
    ])
    expect(merged.holes).toEqual([
      [
        [2, 2],
        [3, 2],
        [3, 3],
        [2, 3],
      ],
      [
        [14, 4],
        [16, 4],
        [16, 6],
        [14, 6],
      ],
    ])
  })

  it('keeps a corner whose two walls are in line but say different things', () => {
    const left = room('left', [
      [0, 0, { texture: 'brick' }],
      [4, 0],
      [4, 4],
      [0, 4],
    ])
    const right = room('right', [
      [4, 0, { texture: 'tile' }],
      [8, 0],
      [8, 4],
      [4, 4],
    ])
    expect(sector(levelOf(afMerge(levelOfRooms(left, right), 'left', 'right')), 'left').corners).toEqual([
      [0, 0, { texture: 'brick' }],
      [4, 0, { texture: 'tile' }],
      [8, 0],
      [8, 4],
      [0, 4],
    ])
  })

  it('keeps a corner where both walls have a door, since the joined wall could not tell them apart', () => {
    const door = { at: 2, width: 1, height: 2 }
    const left = room('left', [
      [0, 0, { door }],
      [4, 0],
      [4, 4],
      [0, 4],
    ])
    const right = room('right', [
      [4, 0, { door }],
      [8, 0],
      [8, 4],
      [4, 4],
    ])
    expect(sector(levelOf(afMerge(levelOfRooms(left, right), 'left', 'right')), 'left').corners).toEqual([
      [0, 0, { door }],
      [4, 0, { door }],
      [8, 0],
      [8, 4],
      [0, 4],
    ])
  })
})

describe('mergeSectors on harder levels', () => {
  it('writes the outline the way the kept sector runs when both run clockwise', () => {
    const left = room('left', [
      [0, 0],
      [0, 4],
      [4, 4],
      [4, 0],
    ])
    const right = room('right', [
      [4, 0],
      [4, 4],
      [8, 4],
      [8, 0],
    ])
    expect(sector(levelOf(afMerge(levelOfRooms(left, right), 'left', 'right')), 'left').corners).toEqual([
      [0, 0],
      [0, 4],
      [8, 4],
      [8, 0],
    ])
  })

  it('keeps the corners of a junction that is not in line', () => {
    const left = room('left', [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ])
    const wedge = room('wedge', [
      [4, 0],
      [7, 2],
      [4, 4],
    ])
    expect(sector(levelOf(afMerge(levelOfRooms(left, wedge), 'left', 'wedge')), 'left').corners).toEqual([
      [0, 0],
      [4, 0],
      [7, 2],
      [4, 4],
      [0, 4],
    ])
  })

  it('gives back a room that stands in the hole of another, whose walls all lead into it', () => {
    // A ring of floor round a room: the ring’s hole walls are the room’s walls turned round.
    const ring = room(
      'ring',
      [
        [-10, -10],
        [20, -10],
        [20, 20],
        [-10, 20],
      ],
      {
        holes: [
          [
            [10, 0, { next: 'k' }],
            [0, 0, { next: 'k' }],
            [0, 10, { next: 'k' }],
            [10, 10, { next: 'k' }],
          ],
        ],
      },
    )
    const k = room('k', [
      [0, 0, { next: 'ring' }],
      [10, 0, { next: 'ring' }],
      [10, 10, { next: 'ring' }],
      [0, 10, { next: 'ring' }],
    ])
    const level = levelOfRooms(ring, k)
    const split = afCut(level, 'k', 'k2', [5, 0], [5, 10])
    expect(sector(split, 'ring').holes?.[0]).toHaveLength(6)
    const merged = levelOf(afMerge(split, 'k', 'k2'))
    expect(ids(merged)).toEqual(['ring', 'k'])
    expect(sector(merged, 'ring')).toEqual(sector(level, 'ring'))
    expect(steady(sector(merged, 'k'))).toEqual(sector(level, 'k'))
  })

  it('keeps a portal wall in two pieces when the far side is one wall, which it cannot join', () => {
    const left = room('left', [
      [0, 0, { next: 'c' }],
      [4, 0],
      [4, 4],
      [0, 4],
    ])
    const right = room('right', [
      [4, 0, { next: 'c' }],
      [8, 0],
      [8, 4],
      [4, 4],
    ])
    const c = room('c', [
      [0, 0],
      [0, -3],
      [8, -3],
      [8, 0, { next: 'left' }],
    ])
    const level = levelOf(afMerge(levelOfRooms(left, right, c), 'left', 'right'))
    expect(sector(level, 'left').corners).toEqual([
      [0, 0, { next: 'c' }],
      [4, 0, { next: 'c' }],
      [8, 0],
      [8, 4],
      [0, 4],
    ])
    expect(sector(level, 'c').corners).toEqual(sector(levelOfRooms(left, right, c), 'c').corners)
  })

  it('keeps a portal wall in two pieces when the far side has a corner there but leads somewhere else', () => {
    const left = room('left', [
      [0, 0, { next: 'c' }],
      [4, 0],
      [4, 4],
      [0, 4],
    ])
    const right = room('right', [
      [4, 0, { next: 'c' }],
      [8, 0],
      [8, 4],
      [4, 4],
    ])
    const c = room('c', [
      [0, 0],
      [0, -3],
      [8, -3],
      [8, 0, { next: 'other' }],
      [4, 0, { next: 'other' }],
    ])
    const other = room('other', [
      [30, 0],
      [34, 0],
      [34, 4],
      [30, 4],
    ])
    const before = levelOfRooms(left, right, c, other)
    const level = levelOf(afMerge(before, 'left', 'right'))
    expect(sector(level, 'left').corners).toHaveLength(5)
    expect(sector(level, 'c')).toBe(sector(before, 'c'))
  })

  it('refuses a level the engine cannot build after the merge, in the engine’s own sentence', () => {
    const unbuildable: LevelProfile<AfSector> = {
      ...afSectorProfile,
      geometry: () => {
        throw new GeometryError('the engine cannot build it')
      },
    }
    const split = afCut(depot, 'hall', 'annex', [3, 0], [3, 6])
    const result = mergeSectors<AfSector>({ keep: 'hall', merge: 'annex' }).run(unbuildable, split)
    expect(reasonOf(result)).toBe('the engine cannot build it')
  })
})

describe('mergeSectors refuses what it cannot do', () => {
  const split = afCut(depot, 'hall', 'annex', [3, 0], [3, 6])
  const reason = (level: AfSector, keep: string, merge: string) => reasonOf(afMerge(level, keep, merge))

  it('names a sector that is not there, whichever of the two it is', () => {
    expect(reason(split, 'nowhere', 'annex')).toBe('no sector nowhere')
    expect(reason(split, 'hall', 'nowhere')).toBe('no sector nowhere')
  })

  it('refuses a sector merged with itself', () => {
    expect(reason(split, 'hall', 'hall')).toBe('a sector cannot be merged with itself')
  })

  it('names the heights that differ', () => {
    expect(reason(depot, 'hall', 'dock')).toBe(
      'hall and dock have different floors (0 and -0.5): make them the same first',
    )
    const level = levelOfRooms(
      room('a', [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ]),
      room(
        'b',
        [
          [4, 0],
          [8, 0],
          [8, 4],
          [4, 4],
        ],
        { ceiling: 5 },
      ),
    )
    expect(reason(level, 'a', 'b')).toBe(
      'a and b have different ceilings (4 and 5): make them the same first',
    )
  })

  it('refuses sectors that have no wall in common', () => {
    const level = levelOfRooms(
      room('a', [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ]),
      room('far', [
        [10, 0],
        [14, 0],
        [14, 4],
        [10, 4],
      ]),
      room('touching', [
        [4, 4],
        [8, 4],
        [8, 8],
        [4, 8],
      ]),
      room('half', [
        [4, 0],
        [8, 0],
        [8, 2],
        [4, 2],
      ]),
      room('twin', [
        [0, 0],
        [0, 4],
        [4, 4],
        [4, 0],
      ]),
    )
    const sentence = (other: string) =>
      `a and ${other} have no wall in common: a shared wall runs between the same two corners in both`
    expect(reason(level, 'a', 'far')).toBe(sentence('far'))
    expect(reason(level, 'a', 'touching')).toBe(sentence('touching'))
    expect(reason(level, 'a', 'half')).toBe(sentence('half'))
    expect(reason(level, 'a', 'twin')).toBe(sentence('twin'))
  })

  it('refuses sectors that meet in two places, which would leave a hole', () => {
    // The room wraps round the left one’s east side, touching it at both ends of that side and not in the middle.
    const left = room('left', [
      [0, 0],
      [4, 0],
      [4, 1],
      [4, 3],
      [4, 4],
      [0, 4],
    ])
    const wrap = room('wrap', [
      [4, 0],
      [8, 0],
      [8, 4],
      [4, 4],
      [4, 3],
      [7, 3],
      [7, 1],
      [4, 1],
    ])
    expect(reason(levelOfRooms(left, wrap), 'left', 'wrap')).toBe(
      'left and wrap meet in more than one place, which would leave a hole between them',
    )
  })

  it('refuses a shared wall that leads into a third sector', () => {
    const level = levelOfRooms(
      room('a', [
        [0, 0],
        [4, 0, { next: 'c' }],
        [4, 4],
        [0, 4],
      ]),
      room('b', [
        [4, 0],
        [8, 0],
        [8, 4],
        [4, 4],
      ]),
      room('c', [
        [20, 0],
        [24, 0],
        [24, 4],
        [20, 4],
      ]),
    )
    expect(reason(level, 'a', 'b')).toBe('a wall between a and b leads into c')
    expect(reason(level, 'b', 'a')).toBe('a wall between b and a leads into c')
  })

  it('refuses a merge whose outline is not a sector', () => {
    // The right room runs a metre past the end of the shared wall, along the same line, so the outline would fold back on itself.
    const l = room('l', [
      [0, 0],
      [6, 0],
      [6, 2],
      [2, 2],
      [2, 6],
      [0, 6],
    ])
    const tall = room('tall', [
      [2, 2],
      [6, 2],
      [6, 7],
      [2, 7],
    ])
    expect(reason(levelOfRooms(l, tall), 'l', 'tall')).toBe(
      'l and tall do not make one sector: the outline crosses itself',
    )
  })

  it('refuses a sector that something is tied to, whichever side it is on, and points at it', () => {
    const tied: LevelProfile<AfSector> = {
      ...afSectorProfile,
      sectors: {
        ...afSectorProfile.sectors,
        pinned: (_level, id) => (id === 'dock' ? ['door d (hall → dock)'] : []),
      },
    }
    const merge = (keep: string, other: string) =>
      mergeSectors<AfSector>({ keep, merge: other }).run(tied, depot)
    const sentence = 'dock cannot be merged while something is tied to its walls: door d (hall → dock)'
    expect(merge('dock', 'hall')).toEqual({ ok: false, reason: sentence, at: 'sector:dock' })
    expect(merge('hall', 'dock')).toEqual({ ok: false, reason: sentence, at: 'sector:dock' })
  })

  it('makes no change on a refusal', () => {
    expect(afMerge(depot, 'hall', 'dock').ok).toBe(false)
    expect(depot.sectors).toHaveLength(2)
  })
})
