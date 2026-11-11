import { Container3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { drawByRoom, type RoomPiece } from '#src/features/room-visibility/draw-by-room.ts'
import { createRoomOwnership } from '#src/features/room-visibility/room-ownership.ts'
import { wallGroups } from '#src/features/room-visibility/wall-groups.ts'
import { createWallHider } from '#src/features/room-visibility/wall-hider.ts'
import { LEVEL, POLICY } from './fixtures.ts'

const piece = (id: string, sector: string, part = 'floor', line?: RoomPiece['line']): RoomPiece => ({
  id,
  sector,
  part,
  line,
})

describe('drawByRoom', () => {
  const setup = () => {
    const root = new Container3D()
    const owned = createRoomOwnership(root, POLICY)
    const hider = createWallHider()
    const drawn: Record<string, string[]> = {}
    const meshes = new Map<string, { visible: boolean }>()
    const pieces = [
      piece('hall:floor', 'hall'),
      piece('counter:floor', 'counter'),
      piece('corridor:wall', 'corridor', 'wall', { a: [8, 3], b: [8, 1] }),
      piece('closet:floor', 'closet'),
    ]
    drawByRoom({
      owned,
      policy: POLICY,
      groups: wallGroups(LEVEL),
      hider,
      pieces,
      draw: (_parent, mine) => {
        drawn[mine.map((p) => p.sector).join('+')] = mine.map((p) => p.id)
        for (const p of mine) meshes.set(p.id, { visible: true })
        return { mesh: (id) => meshes.get(id) }
      },
    })
    return { owned, hider, drawn, meshes, root }
  }

  it('draws each room pieces together, in the room own layer', () => {
    const { drawn, root } = setup()
    expect(drawn['hall+counter']).toEqual(['hall:floor', 'counter:floor'])
    expect(drawn.corridor).toEqual(['corridor:wall'])
    expect(root.children).toHaveLength(4)
  })

  it('puts a wall piece in its cutaway group, and only a wall piece', () => {
    const { hider, meshes } = setup()
    expect(hider.groups()).toEqual(['bulkhead'])
    hider.apply(new Set(['bulkhead']))
    expect(meshes.get('corridor:wall')?.visible).toBe(false)
    expect(meshes.get('hall:floor')?.visible).toBe(true)
  })

  it('leaves every layer owned, so the root is complete', () => {
    const { owned } = setup()
    expect(() => owned.assertComplete()).not.toThrow()
  })
})
