import { describe, expect, it } from 'vitest'
import { ROOM } from '#src/features/room/room.ts'
import { routed, routeOf, showHero } from '#src/testing/route.ts'

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
})
