import { describe, expect, it } from 'vitest'
import { plansOf } from '#src/features/room-visibility/room-level.ts'
import {
  hiddenWallGroups,
  wallGroupAt,
  wallGroupOfPiece,
  wallGroups,
  wallRoomOwners,
} from '#src/features/room-visibility/wall-groups.ts'
import { LEVEL, POLICY } from './fixtures.ts'

const roomOf = new Map(
  Object.entries(POLICY.rooms).flatMap(([room, ids]) => ids.map((id) => [id, room] as const)),
)

describe('wallGroups', () => {
  const groups = wallGroups(LEVEL)

  it('groups walls by `cut`, and gives a wall with none a group of its own', () => {
    expect(groups.find((g) => g.id === 'bulkhead')?.edges).toHaveLength(1)
    expect(groups.find((g) => g.id === 'hall:0:0')?.edges).toHaveLength(1)
    expect(groups.length).toBe(20)
  })

  it('runs a wall from its corner to the next, and wraps round to the first', () => {
    const edge = groups.find((g) => g.id === 'bulkhead')?.edges[0]
    expect(edge).toMatchObject({ sector: { id: 'corridor' }, a: { x: 8, z: 4 }, b: { x: 8, z: 0 } })
  })

  it('names the sector on the other side when the wall is a portal', () => {
    expect(groups.find((g) => g.id === 'door-wall')?.edges[0]).toMatchObject({
      sector: { id: 'ward' },
      next: { id: 'hall' },
    })
  })

  it('collects the zones each group hides from', () => {
    expect(groups.find((g) => g.id === 'bulkhead')?.hideFrom).toEqual(['hall'])
    expect(groups.find((g) => g.id === 'door-wall')?.hideFrom).toEqual([])
  })
})

describe('hiddenWallGroups', () => {
  const groups = wallGroups(LEVEL)

  it('hides a group in a zone it hides from, and only there', () => {
    expect([...hiddenWallGroups(groups, 'hall', false)]).toEqual(['bulkhead'])
    expect([...hiddenWallGroups(groups, 'corridor', false)]).toEqual([])
  })

  it('hides nothing in a cutscene', () => {
    expect([...hiddenWallGroups(groups, 'hall', true)]).toEqual([])
  })
})

describe('wallRoomOwners', () => {
  const edges = wallGroups(LEVEL).flatMap((g) => g.edges)

  it('gives a point on a wall the rooms of the span nearest it, both sides of a portal', () => {
    expect(wallRoomOwners(edges, roomOf, { x: 2, z: 4 }).sort()).toEqual(['reception', 'ward'])
  })

  it('follows the span, not the cut id: a point on the bulkhead belongs to the corridor alone', () => {
    expect(wallRoomOwners(edges, roomOf, { x: 8, z: 2 })).toEqual(['corridor'])
  })

  it('plansOf gives each sector its loops', () => {
    expect(plansOf(LEVEL)[0]).toEqual({
      id: 'hall',
      points: [
        [
          { x: 0, z: 0 },
          { x: 4, z: 0 },
          { x: 4, z: 4 },
          { x: 0, z: 4 },
        ],
      ],
    })
  })
})

describe('wallGroupAt', () => {
  const groups = wallGroups(LEVEL)

  it('finds the group of the wall a drawn segment lies on, from the segment alone', () => {
    expect(wallGroupAt(groups, { x: 8, z: 3 }, { x: 8, z: 1 })?.id).toBe('bulkhead')
    expect(wallGroupAt(groups, { x: 8, z: 1 }, { x: 8, z: 3 })?.id).toBe('bulkhead')
  })

  it('finds none for a segment that is on no wall', () => {
    expect(wallGroupAt(groups, { x: 20, z: 20 }, { x: 21, z: 20 })).toBeUndefined()
  })
})

describe('wallGroupOfPiece', () => {
  const groups = wallGroups(LEVEL)

  it('finds the group of a wall piece from its line, and none for a floor or a prop', () => {
    const line = { a: [8, 3], b: [8, 1] } as const
    expect(wallGroupOfPiece(groups, { part: 'wall', line })?.id).toBe('bulkhead')
    expect(wallGroupOfPiece(groups, { part: 'floor', line })).toBeUndefined()
    expect(wallGroupOfPiece(groups, { part: 'wall' })).toBeUndefined()
  })
})
