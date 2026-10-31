import { describe, expect, it } from 'vitest'
import { linkedMaps } from '../../testing/linked-maps'
import { entity, withEntities } from '../../testing/project-edit'
import { levelLinks, worldLinks } from './world-links'
import { worldRects } from './world-model'

// The two linked maps: the village at (0, 0) and the inn at (400, 0), both 320 × 240, a door each way.

describe('worldLinks (plan ED2D.6c decision 5)', () => {
  it('runs each link between the facing edges, curving to its left, so a pair each way stays apart', () => {
    const project = linkedMaps()
    const links = worldLinks(project, worldRects(project, 'main', undefined))
    const door = project.defs.entities.find((def) => def.id === 'door')
    expect(links).toEqual([
      {
        from: 'map-1',
        to: 'inn',
        label: 'Door',
        color: door?.color,
        start: { x: 320, y: 120 },
        control: { x: 360, y: 108 },
        end: { x: 400, y: 120 },
        middle: { x: 360, y: 114 },
      },
      {
        from: 'inn',
        to: 'map-1',
        label: 'Door',
        color: door?.color,
        start: { x: 400, y: 120 },
        control: { x: 360, y: 132 },
        end: { x: 320, y: 120 },
        middle: { x: 360, y: 126 },
      },
    ])
  })

  it('uses the top and bottom edges for a level mostly above or below', () => {
    const project = linkedMaps()
    const rects = worldRects(project, 'main', undefined).map((rect) =>
      rect.id === 'inn' ? { ...rect, x: 0, y: 400 } : rect,
    )
    const [first] = worldLinks(project, rects)
    expect(first).toMatchObject({ start: { x: 160, y: 240 }, end: { x: 160, y: 400 } })
  })

  it('leaves out links inside one level and links to a level the world does not place', () => {
    const inside = withEntities(linkedMaps(), 'map-1', [
      entity('warp-1', 'warp', 200, 100, { target: { target: 'door-out', container: 'map-1' } }),
    ])
    const rects = worldRects(inside, 'main', undefined)
    expect(worldLinks(inside, rects).map((link) => [link.from, link.to])).toEqual([
      ['map-1', 'inn'],
      ['inn', 'map-1'],
    ])
    expect(
      worldLinks(
        inside,
        rects.filter((rect) => rect.id !== 'inn'),
      ),
    ).toEqual([])
  })
})

describe('levelLinks (the inspector’s Links and Linked from)', () => {
  it('lists what a level links to and the levels that link to it', () => {
    const project = withEntities(linkedMaps(), 'map-1', [
      entity('warp-1', 'warp', 200, 100, { target: { target: 'door-out', container: 'map-1' } }),
    ])
    expect(levelLinks(project, 'map-1')).toEqual({
      out: [
        { source: 'door-out', label: 'Door', to: 'Inn · Door' },
        { source: 'warp-1', label: 'Warp', to: 'Village · Door' },
      ],
      from: ['Inn'],
    })
    expect(levelLinks(project, 'inn')).toEqual({
      out: [{ source: 'door-in', label: 'Door', to: 'Village · Door' }],
      from: ['Village'],
    })
  })
})
