import { content } from 'virtual:automata/content'
import { describe, expect, it } from 'vitest'
import { ROOM, roomWorld } from '#src/features/room/room.ts'
import { routed, routeOf, showHero, showRoom } from '#src/testing/route.ts'

// The journeys' route: a normal build never reads the address or writes Wick's place.
describe('the journeys’ route', () => {
  it('is read only in a journeys build, and only for a route it knows', () => {
    expect(routeOf('?route=goal', false)).toBeUndefined()
    expect(routeOf('?route=goal', true)).toBe('goal')
    expect(routeOf('?route=nowhere', true)).toBeUndefined()
    expect(routeOf('', true)).toBeUndefined()
  })

  it('moves only the spawn, and keeps the room as it is without a route', () => {
    expect(routed(ROOM, undefined)).toBe(ROOM)
    const goal = routed(ROOM, 'goal')
    expect(goal.spawn).toEqual({ x: 0, z: 24 })
    expect({ ...goal, spawn: ROOM.spawn }).toEqual(ROOM)
  })

  it('writes Wick’s place in metres only when asked', () => {
    const root = { dataset: {} } as unknown as HTMLElement
    const result = {
      render: { added: [], changed: [{ components: { hero: { x: 65_536 * 2, z: 32_768 } } }] },
    } as never
    showHero(result, false, root)
    expect(root.dataset.hero).toBeUndefined()
    showHero(result, true, root)
    expect(root.dataset.hero).toBe('2.00,0.50')
  })

  it('writes each prop’s place and each floor’s height, in metres, only when asked', () => {
    const root = { dataset: {} } as unknown as HTMLElement
    const room = {
      world: {
        pieces: [
          {
            id: 'a:floor',
            sector: 'start',
            part: 'floor',
            mesh: { positions: [0, 0, 0, 1, 0, 0, 1, 0, 1], normals: [], indices: [] },
          },
          {
            id: 'b:floor',
            sector: 'middle',
            part: 'floor',
            mesh: { positions: [0, 0.5, 0, 1, 0.5, 0, 1, 0.5, 1], normals: [], indices: [] },
          },
          {
            id: 'c:wall',
            sector: 'middle',
            part: 'wall',
            mesh: { positions: [0, 9, 0], normals: [], indices: [] },
          },
          {
            id: 'p:0',
            sector: 'middle',
            part: 'prop',
            mesh: { positions: [], normals: [], indices: [] },
            prop: { id: 'crate-2', at: [3, 0.5, 6.5] },
          },
          {
            id: 'p:1',
            sector: 'middle',
            part: 'prop',
            mesh: { positions: [], normals: [], indices: [] },
            prop: { id: 'crate-2', at: [3, 0.5, 6.5] },
          },
          {
            id: 'q:0',
            sector: 'start',
            part: 'prop',
            mesh: { positions: [], normals: [], indices: [] },
            prop: { id: 'barrel-1', at: [-4, 0, 5.4] },
          },
        ],
      },
      library: { swatches: {} },
    } as never
    showRoom(room, false, root)
    expect(root.dataset).toEqual({})
    showRoom(room, true, root)
    expect(root.dataset.props).toBe('crate-2:3.00,6.50;barrel-1:-4.00,5.40')
    expect(root.dataset.floors).toBe('start:0.00;middle:0.50')
  })

  it('reads the room the game ships: five props and five floors', () => {
    const root = { dataset: {} } as unknown as HTMLElement
    showRoom(roomWorld(content), true, root)
    expect(root.dataset.props).toContain('crate-2:4.00,6.50')
    expect(root.dataset.floors).toContain('middle:0.00')
  })
})
