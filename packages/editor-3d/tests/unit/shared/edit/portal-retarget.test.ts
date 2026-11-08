// Pointing the other side of a portal at a new sector (ED3D.6e): when a stretch of wall moves from one sector to another
// (a cut makes a new sector of half a room, a merge takes a room into its neighbour), the wall of the sector on the far
// side that runs back over it must lead into the sector the wall now belongs to, or the portal pair stops matching.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { type PortalMove, redirectPortals, retargetPortals } from '#src/shared/edit/portal-retarget.ts'
import type { Changes } from '#src/shared/edit/vertex-edits.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import type { EditSector } from '#src/shared/level-session/sector-access.ts'
import { must } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { toyAfSector, toyDock, toyHall } from '#src/testing/toy-af-sector.ts'

const depot = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const afMove = (changes: Changes, move: PortalMove, level: AfSector = depot) =>
  retargetPortals(afSectorProfile, level, changes, move)
const wallOf = (changes: Changes, id: string, corner: number) => must(changes.get(id)).corners[corner]?.[2]

/** The depot's dock leads into the hall along x = 8, from (8, 6) up to (8, 0). Pretend that wall now belongs to `annex`. */
const dockWall: PortalMove = {
  from: 'dock',
  to: 'annex',
  spans: [{ start: [8, 6], end: [8, 0], into: 'hall' }],
}

describe('retargetPortals', () => {
  it('points the wall of the far sector that runs back over the span at the new sector', () => {
    const result = afMove(new Map(), dockWall)
    expect([...result.keys()]).toEqual(['hall'])
    expect(wallOf(result, 'hall', 1)).toEqual({ next: 'annex' })
  })

  it('finds the wall whichever way round the span and the far sector are written', () => {
    const turned: PortalMove = { ...dockWall, spans: [{ start: [8, 0], end: [8, 6], into: 'hall' }] }
    expect(wallOf(afMove(new Map(), turned), 'hall', 1)).toEqual({ next: 'annex' })
  })

  it('changes nothing about the wall but where it leads, and nothing about any other wall or sector', () => {
    const level: AfSector = toyAfSector({
      sectors: [
        {
          id: 'hall',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0, { texture: 'brick' }],
            [8, 0, { next: 'dock', texture: 'brick', frame: true, thick: 0.3 }],
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
            [8, 0],
            [14, 0],
            [14, 6],
            [8, 6],
          ],
        },
      ],
    })
    const move: PortalMove = {
      from: 'dock',
      to: 'annex',
      spans: [{ start: [8, 0], end: [8, 6], into: 'hall' }],
    }
    // The hall's east wall is written [8, 0] to [8, 6].
    const result = afMove(new Map(), move, level)
    const hall = must(result.get('hall'))
    expect(hall.corners[1]).toEqual([8, 0, { next: 'annex', texture: 'brick', frame: true, thick: 0.3 }])
    expect(hall.corners[0]).toBe(must(level.sectors[0]).corners[0])
    expect(hall.corners[2]).toBe(must(level.sectors[0]).corners[2])
    expect(result.has('dock')).toBe(false)
  })

  it('leaves a wall of the far sector that does not lead into the sector alone', () => {
    // The hall's east wall leads into the dock, so a span claiming the hall's lead into `yard` finds nothing.
    const move: PortalMove = {
      from: 'yard',
      to: 'annex',
      spans: [{ start: [8, 6], end: [8, 0], into: 'hall' }],
    }
    const changes: Changes = new Map()
    expect(afMove(changes, move)).toBe(changes)
  })

  it('answers the working set itself when there is nothing to point elsewhere', () => {
    const changes: Changes = new Map()
    expect(afMove(changes, { from: 'dock', to: 'annex', spans: [] })).toBe(changes)
    const nothingOver: PortalMove = {
      from: 'dock',
      to: 'annex',
      spans: [{ start: [8, 1], end: [8, 5], into: 'hall' }],
    }
    expect(afMove(changes, nothingOver)).toBe(changes)
    const noSuchSector: PortalMove = {
      from: 'dock',
      to: 'annex',
      spans: [{ start: [8, 6], end: [8, 0], into: 'nowhere' }],
    }
    expect(afMove(changes, noSuchSector)).toBe(changes)
  })

  it('does not touch the sectors it is told about as the old and the new owner', () => {
    // The dock’s west wall leads into the dock itself, over the span: the old owner’s walls are not rewritten.
    const selfPortal: AfSector = toyAfSector({
      sectors: [
        {
          ...toyHall,
          corners: [
            [0, 0],
            [8, 0],
            [8, 6],
            [0, 6],
          ],
        },
        {
          ...toyDock,
          corners: [
            [8, 0],
            [14, 0],
            [14, 6],
            [8, 6, { next: 'dock' }],
          ],
        },
      ],
    })
    const toDock: PortalMove = {
      from: 'dock',
      to: 'annex',
      spans: [{ start: [8, 6], end: [8, 0], into: 'dock' }],
    }
    const changes: Changes = new Map()
    expect(afMove(changes, toDock, selfPortal)).toBe(changes)
    const toAnnex: PortalMove = {
      from: 'dock',
      to: 'hall',
      spans: [{ start: [8, 6], end: [8, 0], into: 'hall' }],
    }
    expect(afMove(changes, toAnnex)).toBe(changes)
  })

  it('builds on the working set: a far sector that an earlier change already holds is the one changed', () => {
    const earlier = must(depot.sectors[0])
    const dimmer: EditSector = { ...earlier, light: 0.5 }
    const result = afMove(new Map([['hall', dimmer]]), dockWall)
    expect(must(result.get('hall')).light).toBe(0.5)
    expect(wallOf(result, 'hall', 1)).toEqual({ next: 'annex' })
  })

  it('retargets two spans in one far sector, the second on top of the first', () => {
    const level: AfSector = toyAfSector({
      sectors: [
        {
          ...toyHall,
          corners: [
            [0, 0],
            [8, 0, { next: 'dock' }],
            [8, 3, { next: 'dock' }],
            [8, 6],
            [0, 6],
          ],
        },
        {
          ...toyDock,
          corners: [
            [8, 0],
            [14, 0],
            [14, 6],
            [8, 6, { next: 'hall' }],
            [8, 3, { next: 'hall' }],
          ],
        },
      ],
    })
    const move: PortalMove = {
      from: 'dock',
      to: 'annex',
      spans: [
        { start: [8, 0], end: [8, 3], into: 'hall' },
        { start: [8, 3], end: [8, 6], into: 'hall' },
      ],
    }
    const result = afMove(new Map(), move, level)
    expect(wallOf(result, 'hall', 1)).toEqual({ next: 'annex' })
    expect(wallOf(result, 'hall', 2)).toEqual({ next: 'annex' })
  })

  it('does not change the working set it is given', () => {
    const changes: Changes = new Map()
    afMove(changes, dockWall)
    expect(changes.size).toBe(0)
    expect(wallOf(new Map([['hall', must(depot.sectors[0])]]), 'hall', 1)).toEqual({ next: 'dock' })
  })

  it('retargets several spans, one in each far sector', () => {
    const level: AfSector = toyAfSector({
      sectors: [
        {
          id: 'a',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [4, 0, { next: 'mid' }],
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
            [4, 4, { next: 'mid' }],
            [8, 4],
            [8, 8],
            [4, 8],
          ],
        },
        {
          id: 'mid',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [4, 0],
            [8, 0],
            [8, 4, { next: 'b' }],
            [4, 4, { next: 'a' }],
          ],
        },
      ],
    })
    const move: PortalMove = {
      from: 'mid',
      to: 'big',
      spans: [
        { start: [4, 4], end: [4, 0], into: 'a' },
        { start: [8, 4], end: [4, 4], into: 'b' },
      ],
    }
    const result = afMove(new Map(), move, level)
    expect(wallOf(result, 'a', 1)).toEqual({ next: 'big' })
    expect(wallOf(result, 'b', 0)).toEqual({ next: 'big' })
    expect([...result.keys()].sort()).toEqual(['a', 'b'])
  })
})

describe('redirectPortals', () => {
  /** Three rooms in a row, a | mid | b, along x, each 4 m by 4 m. */
  const row: AfSector = toyAfSector({
    sectors: [
      {
        id: 'a',
        floor: 0,
        ceiling: 4,
        light: 1,
        corners: [
          [0, 0],
          [4, 0, { next: 'mid' }],
          [4, 4],
          [0, 4],
        ],
      },
      {
        id: 'mid',
        floor: 0,
        ceiling: 4,
        light: 1,
        corners: [
          [4, 0],
          [8, 0, { next: 'b' }],
          [8, 4],
          [4, 4, { next: 'a' }],
        ],
      },
      {
        id: 'b',
        floor: 0,
        ceiling: 4,
        light: 1,
        corners: [
          [8, 0],
          [12, 0],
          [12, 4],
          [8, 4, { next: 'mid', frame: true, thick: 0.3 }],
        ],
      },
    ],
  })
  const redirect = (changes: Changes, from: string, to: string, level: AfSector = row) =>
    redirectPortals(afSectorProfile, level, changes, { from, to })

  it('points every wall of every other sector that leads into the sector at the new one', () => {
    const result = redirect(new Map(), 'mid', 'big')
    expect([...result.keys()]).toEqual(['a', 'b'])
    expect(wallOf(result, 'a', 1)).toEqual({ next: 'big' })
    expect(wallOf(result, 'b', 3)).toEqual({ next: 'big', frame: true, thick: 0.3 })
  })

  it('leaves the sector it takes the portals from, and the one it gives them to, alone', () => {
    const result = redirect(new Map(), 'mid', 'a')
    expect([...result.keys()]).toEqual(['b'])
    expect(wallOf(result, 'b', 3)).toEqual({ next: 'a', frame: true, thick: 0.3 })
  })

  it('does not rewrite the walls of the sector that goes, which lead into itself', () => {
    const level: AfSector = toyAfSector({
      sectors: [
        {
          ...toyHall,
          id: 'solo',
          corners: [
            [0, 0, { next: 'solo' }],
            [8, 0],
            [8, 6],
            [0, 6],
          ],
        },
      ],
    })
    const changes: Changes = new Map()
    expect(redirect(changes, 'solo', 'big', level)).toBe(changes)
  })

  it('changes nothing else about a sector: the walls it does not touch are the same objects', () => {
    const result = redirect(new Map(), 'mid', 'big')
    const before = must(row.sectors[2])
    expect(must(result.get('b')).corners[0]).toBe(before.corners[0])
    expect(must(result.get('b')).corners[3]).not.toBe(before.corners[3])
  })

  it('reaches a wall of a hole', () => {
    const level: AfSector = toyAfSector({
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
          holes: [
            [
              [4, 4, { next: 'island' }],
              [6, 4],
              [6, 6],
              [4, 6],
            ],
          ],
        },
      ],
    })
    const result = redirect(new Map(), 'island', 'rest', level)
    const plaza = must(result.get('plaza'))
    expect(plaza.holes?.[0]?.[0]).toEqual([4, 4, { next: 'rest' }])
    expect(plaza.corners).toBe(must(level.sectors[0]).corners)
  })

  it('answers the working set itself when nothing leads into the sector', () => {
    const changes: Changes = new Map()
    expect(redirect(changes, 'nowhere', 'big')).toBe(changes)
  })

  it('builds on the working set: a sector that an earlier change already holds is the one changed', () => {
    const dimmer: EditSector = { ...must(row.sectors[0]), light: 0.5 }
    const result = redirect(new Map([['a', dimmer]]), 'mid', 'big')
    expect(must(result.get('a')).light).toBe(0.5)
    expect(wallOf(result, 'a', 1)).toEqual({ next: 'big' })
  })

  it('does not change the working set it is given', () => {
    const changes: Changes = new Map()
    redirect(changes, 'mid', 'big')
    expect(changes.size).toBe(0)
  })
})
