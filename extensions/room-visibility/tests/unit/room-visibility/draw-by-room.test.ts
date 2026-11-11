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

  describe('masses', () => {
    // A mass is drawn by the builder as `<sector>:mass<index>:<part>`, in the sector its middle falls in; the policy
    // says which rooms own it, so a mass that two rooms share draws when either is seen.
    const withMasses = () => {
      const root = new Container3D()
      const owned = createRoomOwnership(root, POLICY)
      const meshes = new Map<string, { visible: boolean }>()
      const layers: Record<string, string[]> = {}
      drawByRoom({
        owned,
        policy: POLICY,
        groups: wallGroups(LEVEL),
        hider: createWallHider(),
        pieces: [
          piece('hall:floor', 'hall'),
          piece('hall:mass0:top', 'hall', 'wall', { a: [0, 0], b: [1, 0] }),
          piece('ward:mass0:face1', 'ward', 'wall', { a: [0, 4], b: [1, 4] }),
          piece('corridor:mass1:top', 'corridor', 'wall', { a: [8, 0], b: [9, 0] }),
        ],
        draw: (parent, mine) => {
          layers[String(root.getChildIndex(parent.parent as Container3D))] = mine.map((p) => p.id)
          for (const p of mine) meshes.set(p.id, parent as unknown as { visible: boolean })
          return { mesh: () => undefined }
        },
      })
      return { owned, root, layers, meshes }
    }

    it('draws a mass in a layer owned by the policy owners of its index, whatever sector it is in', () => {
      const { layers } = withMasses()
      const drawn = Object.values(layers)
      expect(drawn).toContainEqual(['hall:mass0:top', 'ward:mass0:face1'])
      expect(drawn).toContainEqual(['corridor:mass1:top'])
      expect(drawn).toContainEqual(['hall:floor'])
    })

    it('shows a shared mass while either of its rooms is seen, and a global mass always', () => {
      const { owned, meshes } = withMasses()
      const shown = (ids: string[]) => {
        owned.apply(new Set(ids))
        const visibleMask = (id: string) =>
          (meshes.get(id) as unknown as { parent: { visible: boolean } }).parent.visible
        return { shared: visibleMask('hall:mass0:top'), global: visibleMask('corridor:mass1:top') }
      }
      expect(shown(['ward'])).toEqual({ shared: true, global: true })
      expect(shown(['corridor'])).toEqual({ shared: false, global: true })
    })
  })
})
