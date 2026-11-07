// The corner and sector moves (ED3D.3 step 6): `sector.moveCorner` with the rule that a portal's reverse follows, and
// `sector.move`, which leaves the neighbours where they are. On the depot and on small levels that show one rule each.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { afSectorProfile } from '../profile/af-sector-profile'
import type { EditSector } from '../profile/sector-access'
import { levelOf, must, reasonOf } from '../testing/edit-helpers'
import { loadAuthored } from '../testing/fixtures'
import { toyAfSector } from '../testing/toy-af-sector'
import { moveCorner, moveSector } from './corner-edits'
import type { Edit } from './edit'
import { createLevelEditor } from './level-editor'

const depot = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const afOn = (level: AfSector, edit: Edit<AfSector>) => edit.run(afSectorProfile, level)
const afRun = (edit: Edit<AfSector>) => afOn(depot, edit)
const sector = (level: AfSector, id: string): EditSector =>
  must(afSectorProfile.sectors.list(level).find((each) => each.id === id))
const openings = (level: AfSector) => must(afSectorProfile.checks(level).find((r) => r.id === 'openings'))

/** Three sectors that meet at the origin; `joinAB` says whether a and b are portals into each other as well. */
const fan = (joinAB: boolean): AfSector =>
  toyAfSector({
    sectors: [
      {
        id: 'a',
        floor: 0,
        ceiling: 3,
        light: 1,
        corners: [[0, 0, { next: 'c' }], [4, 0], [4, 4], joinAB ? [0, 4, { next: 'b' }] : [0, 4]],
      },
      {
        id: 'b',
        floor: 0,
        ceiling: 3,
        light: 1,
        corners: [[-4, 0, { next: 'c' }], joinAB ? [0, 0, { next: 'a' }] : [0, 0], [0, 4], [-4, 4]],
      },
      {
        id: 'c',
        floor: 0,
        ceiling: 3,
        light: 1,
        corners: [
          [-4, -4],
          [4, -4],
          [4, 0, { next: 'a' }],
          [0, 0, { next: 'b' }],
          [-4, 0],
        ],
      },
    ],
  })

/** A room with a hole, and a sector in the hole whose walls are the hole's reverse. */
const ring = (): AfSector =>
  toyAfSector({
    sectors: [
      {
        id: 'outer',
        floor: 0,
        ceiling: 3,
        light: 1,
        corners: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        holes: [
          [
            [3, 3, { next: 'inner' }],
            [3, 7, { next: 'inner' }],
            [7, 7, { next: 'inner' }],
            [7, 3, { next: 'inner' }],
          ],
        ],
      },
      {
        id: 'inner',
        floor: 0,
        ceiling: 3,
        light: 1,
        corners: [
          [3, 3, { next: 'outer' }],
          [7, 3, { next: 'outer' }],
          [7, 7, { next: 'outer' }],
          [3, 7, { next: 'outer' }],
        ],
      },
    ],
  })

describe('sector.moveCorner', () => {
  it('moves one corner of the outline, writes four decimals and keeps the wall it starts', () => {
    const next = levelOf(afRun(moveCorner({ sector: 'hall', corner: 0, x: -1.00004, z: 0.00006 })))
    const hall = sector(depot, 'hall')
    expect(sector(next, 'hall').corners).toEqual([
      [-1, 0.0001, must(hall.corners[0])[2]],
      hall.corners[1],
      hall.corners[2],
      hall.corners[3],
    ])
    expect(sector(next, 'dock')).toBe(sector(depot, 'dock'))
  })

  it("moves a portal wall's reverse corner with it, so the portal still has its reverse", () => {
    const next = levelOf(afRun(moveCorner({ sector: 'hall', corner: 1, x: 9, z: 0.5 })))
    expect(sector(next, 'hall').corners[1]).toEqual([9, 0.5, { next: 'dock' }])
    expect(sector(next, 'dock').corners[0]).toEqual([9, 0.5])
    expect(afSectorProfile.checks(next).every((result) => result.ok)).toBe(true)
  })

  it('looks at both walls of the corner: the one that arrives as well as the one that leaves', () => {
    const next = levelOf(afRun(moveCorner({ sector: 'hall', corner: 2, x: 7.5, z: 6 })))
    expect(sector(next, 'hall').corners[2]).toEqual([7.5, 6])
    expect(sector(next, 'dock').corners[3]).toEqual([7.5, 6, { next: 'hall' }])
    expect(openings(next).ok).toBe(true)
  })

  it('moves the corner of the sector that the reverse is seen from, too', () => {
    const next = levelOf(afRun(moveCorner({ sector: 'dock', corner: 3, x: 8, z: 5 })))
    expect(sector(next, 'dock').corners[3]).toEqual([8, 5, { next: 'hall' }])
    expect(sector(next, 'hall').corners[2]).toEqual([8, 5])
    expect(openings(next).ok).toBe(true)
  })

  it('finds a reverse corner written a hair off the corner it follows', () => {
    const [hall, dock] = [must(depot.sectors[0]), must(depot.sectors[1])]
    const drifted = toyAfSector({
      sectors: [hall, { ...dock, corners: [[8.0000005, 0.0000005], ...dock.corners.slice(1)] }],
    })
    const next = levelOf(afOn(drifted, moveCorner({ sector: 'hall', corner: 1, x: 9, z: 0 })))
    expect(sector(next, 'dock').corners[0]).toEqual([9, 0])
  })

  it("moves a portal wall's corner alone when nothing leads back over its segment", () => {
    const [hall, dock] = [must(depot.sectors[0]), must(depot.sectors[1])]
    const walled = toyAfSector({
      sectors: [hall, { ...dock, corners: [dock.corners[0], dock.corners[1], dock.corners[2], [8, 6]] }],
    } as Partial<AfSector>)
    const next = levelOf(afOn(walled, moveCorner({ sector: 'hall', corner: 1, x: 9, z: 0 })))
    expect(sector(next, 'hall').corners[1]).toEqual([9, 0, { next: 'dock' }])
    expect(sector(next, 'dock').corners[0]).toEqual([8, 0])
    const apart = toyAfSector({
      sectors: [hall, { ...dock, corners: [[8, 0.01], ...dock.corners.slice(1)] }],
    } as Partial<AfSector>)
    const other = levelOf(afOn(apart, moveCorner({ sector: 'hall', corner: 1, x: 9, z: 0 })))
    expect(sector(other, 'dock').corners[0]).toEqual([8, 0.01])
  })

  it('does not take for a reverse a portal that only lies on the same line', () => {
    const [hall, dock] = [sector(depot, 'hall'), sector(depot, 'dock')]
    const level = toyAfSector({
      sectors: [
        {
          ...hall,
          corners: [hall.corners[0], [8, 0, { next: 'long' }], hall.corners[2], hall.corners[3]],
        },
        {
          ...dock,
          id: 'long',
          corners: [
            [8, 100, { next: 'hall' }],
            [8, 0],
            [14, 0],
            [14, 100],
          ],
        },
      ],
    } as Partial<AfSector>)
    const next = levelOf(afOn(level, moveCorner({ sector: 'hall', corner: 1, x: 9, z: 0 })))
    expect(sector(next, 'long').corners[1]).toEqual([8, 0])
  })

  it('follows every corner that meets there through portals, once, and no other', () => {
    const joined = fan(true)
    const next = levelOf(afOn(joined, moveCorner({ sector: 'a', corner: 0, x: 1, z: -0.5 })))
    expect(sector(next, 'a').corners[0]).toEqual([1, -0.5, { next: 'c' }])
    expect(sector(next, 'b').corners[1]).toEqual([1, -0.5, { next: 'a' }])
    expect(sector(next, 'c').corners[3]).toEqual([1, -0.5, { next: 'b' }])
    expect(sector(next, 'c').corners[2]).toEqual([4, 0, { next: 'a' }])
    expect(openings(next).ok).toBe(true)
  })

  it('goes on from the corners it moved: two sectors that join only through a third come along', () => {
    const apart = fan(false)
    const next = levelOf(afOn(apart, moveCorner({ sector: 'a', corner: 0, x: 1, z: -0.5 })))
    expect(sector(next, 'c').corners[3]).toEqual([1, -0.5, { next: 'b' }])
    expect(sector(next, 'b').corners[1]).toEqual([1, -0.5])
    expect(sector(next, 'b').corners[0]).toEqual(must(sector(apart, 'b').corners[0]))
    expect(sector(next, 'a').corners[3]).toEqual([0, 4])
  })

  it("moves a corner of a hole when the reverse of the wall is the hole's", () => {
    const level = ring()
    const next = levelOf(afOn(level, moveCorner({ sector: 'inner', corner: 0, x: 3.5, z: 3.5 })))
    expect(sector(next, 'inner').corners[0]).toEqual([3.5, 3.5, { next: 'outer' }])
    expect(sector(next, 'outer').holes?.[0]?.[0]).toEqual([3.5, 3.5, { next: 'inner' }])
    expect(sector(next, 'outer').corners).toEqual(sector(level, 'outer').corners)
    expect(openings(next).ok).toBe(true)
  })

  it('changes nothing when the corner is where it is told to go', () => {
    expect(afRun(moveCorner({ sector: 'hall', corner: 1, x: 8, z: 0 }))).toEqual({ ok: true, level: depot })
    expect(levelOf(afRun(moveCorner({ sector: 'hall', corner: 1, x: 8.00001, z: -0.00001 })))).toBe(depot)
  })

  it('refuses a sector that is not there and a corner that is not one of the outline', () => {
    expect(afRun(moveCorner({ sector: 'nowhere', corner: 0, x: 1, z: 1 }))).toEqual({
      ok: false,
      reason: 'no sector nowhere',
    })
    for (const corner of [-1, 4, 1.5, Number.NaN])
      expect(reasonOf(afRun(moveCorner({ sector: 'hall', corner, x: 1, z: 1 })))).toBe(
        `sector hall has no corner ${corner}`,
      )
  })

  it('refuses a point that is not two numbers', () => {
    const reason = 'the point must be two numbers'
    expect(reasonOf(afRun(moveCorner({ sector: 'hall', corner: 0, x: Number.NaN, z: 0 })))).toBe(reason)
    expect(
      reasonOf(afRun(moveCorner({ sector: 'hall', corner: 0, x: 0, z: Number.POSITIVE_INFINITY }))),
    ).toBe(reason)
  })

  it('refuses a move that stops the outline being a polygon, in the words of the loop rules', () => {
    expect(reasonOf(afRun(moveCorner({ sector: 'hall', corner: 2, x: 8, z: -2 })))).toBe(
      'the outline crosses itself',
    )
    expect(reasonOf(afRun(moveCorner({ sector: 'hall', corner: 1, x: 8, z: 6 })))).toBe(
      'corners 1 and 2 are the same point',
    )
  })

  it('refuses a move that breaks the outline of a sector that follows, naming it', () => {
    expect(reasonOf(afRun(moveCorner({ sector: 'hall', corner: 1, x: 20, z: 3 })))).toBe(
      'dock: the outline crosses itself',
    )
  })

  it('is called sector.moveCorner, coalesces on the corner and says which it moves', () => {
    const edit = moveCorner({ sector: 'hall', corner: 2, x: 1, z: 1 })
    expect(edit.id).toBe('sector.moveCorner')
    expect(edit.coalesce).toBe('corner:hall/2')
    expect(edit.label).toBe('Move corner 2 of hall')
  })

  it('is one undo step for a whole drag, and undo puts the depot back', () => {
    const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
    const drag = editor.begin('Move corner 1 of hall')
    for (const x of [8.25, 8.5, 9]) drag.run(moveCorner({ sector: 'hall', corner: 1, x, z: 0 }))
    drag.commit()
    expect(editor.history.revision).toBe(1)
    expect(sector(editor.level, 'dock').corners[0]).toEqual([9, 0])
    editor.history.undo()
    expect(editor.level).toBe(depot)
  })
})

describe('sector.move', () => {
  it('moves the outline by the offset, to four decimals, and nothing else of the sector', () => {
    const next = levelOf(afRun(moveSector({ id: 'dock', dx: 2.00006, dz: -1 })))
    expect(sector(next, 'dock')).toEqual({
      ...sector(depot, 'dock'),
      corners: [
        [10.0001, -1],
        [16.0001, -1],
        [16.0001, 5],
        [10.0001, 5, { next: 'hall' }],
      ],
    })
    expect(sector(next, 'hall')).toBe(sector(depot, 'hall'))
  })

  it('moves the holes with the outline and leaves the sector in the hole where it is', () => {
    const next = levelOf(afOn(ring(), moveSector({ id: 'outer', dx: 1, dz: 2 })))
    expect(sector(next, 'outer').corners).toEqual([
      [1, 2],
      [11, 2],
      [11, 12],
      [1, 12],
    ])
    expect(sector(next, 'outer').holes).toEqual([
      [
        [4, 5, { next: 'inner' }],
        [4, 9, { next: 'inner' }],
        [8, 9, { next: 'inner' }],
        [8, 5, { next: 'inner' }],
      ],
    ])
    expect(sector(next, 'inner')).toEqual(sector(ring(), 'inner'))
  })

  it("leaves the neighbours' portals where they were, so `openings` names the walls (ED3-e)", () => {
    const next = levelOf(afRun(moveSector({ id: 'dock', dx: 0, dz: 3 })))
    const result = openings(next)
    expect(result.ok).toBe(false)
    expect(result.problems.map((problem) => problem.locator?.selection)).toEqual([
      'wall:hall/1',
      'wall:dock/3',
    ])
    const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
    editor.run(moveSector({ id: 'dock', dx: 0, dz: 3 }))
    editor.history.undo()
    expect(openings(editor.level).ok).toBe(true)
  })

  it('records nothing for an offset of nothing, or of less than the four decimals', () => {
    expect(afRun(moveSector({ id: 'dock', dx: 0, dz: 0 }))).toEqual({ ok: true, level: depot })
    expect(levelOf(afRun(moveSector({ id: 'dock', dx: 0.00001, dz: -0.00002 })))).toBe(depot)
  })

  it('refuses an offset that is not two numbers, and a sector that is not there', () => {
    expect(reasonOf(afRun(moveSector({ id: 'dock', dx: Number.NaN, dz: 0 })))).toBe(
      'the offset must be two numbers',
    )
    expect(reasonOf(afRun(moveSector({ id: 'dock', dx: 1, dz: Number.NEGATIVE_INFINITY })))).toBe(
      'the offset must be two numbers',
    )
    expect(afRun(moveSector({ id: 'nowhere', dx: 1, dz: 0 }))).toEqual({
      ok: false,
      reason: 'no sector nowhere',
    })
  })

  it('is called sector.move, coalesces on the sector and says which it moves', () => {
    const edit = moveSector({ id: 'dock', dx: 1, dz: 1 })
    expect(edit.id).toBe('sector.move')
    expect(edit.coalesce).toBe('move:dock')
    expect(edit.label).toBe('Move sector dock')
  })
})
