import { describe, expect, it } from 'vitest'
import { levelLinks, worldLinks } from '#src/shared/level-2d/model/world/world-links.ts'
import { worldRects } from '#src/shared/level-2d/model/world/world-model.ts'
import { linkedMaps } from '#src/testing/level-2d/linked-maps.ts'
import { entity, withDefs, withEntities, withLevel } from '#src/testing/level-2d/project-edit.ts'

// The two linked maps: the village at (0, 0) and the inn at (400, 0), both 320 × 240, a door each way.

describe('worldLinks (plan ED2D.6c decision 5)', () => {
  it('runs each link from the source on the map to its target, bowing to its left so a pair each way stays apart', () => {
    const project = linkedMaps()
    const links = worldLinks(project, worldRects(project, 'main', undefined))
    const door = project.defs.entities.find((def) => def.id === 'door')
    expect(
      links.map(({ from, to, label, color, start, end }) => ({ from, to, label, color, start, end })),
    ).toEqual([
      {
        from: 'map-1',
        to: 'inn',
        label: 'Door',
        color: door?.color,
        start: { x: 96, y: 64 },
        end: { x: 432, y: 200 },
      },
      {
        from: 'inn',
        to: 'map-1',
        label: 'Door',
        color: door?.color,
        start: { x: 432, y: 200 },
        end: { x: 96, y: 64 },
      },
    ])
    const [out, back] = links
    if (out === undefined || back === undefined) throw new Error('two links')
    // The control point sits off the chord's middle (264, 132) to the left of travel, the way back to the other side.
    const side = (link: typeof out) =>
      Math.sign(
        (link.end.x - link.start.x) * (link.control.y - link.start.y) -
          (link.end.y - link.start.y) * (link.control.x - link.start.x),
      )
    expect(side(out)).toBe(-1)
    expect(side(back)).toBe(-1)
    expect(Math.hypot(out.control.x - back.control.x, out.control.y - back.control.y)).toBeGreaterThanOrEqual(
      80,
    )
    // The label sits at the curve's middle: a quarter of each end and half the control point.
    expect(out.middle.x).toBeCloseTo(0.25 * 96 + 0.5 * out.control.x + 0.25 * 432)
  })

  it('uses a level’s centre for a level target and for a level field', () => {
    const project = withDefs(linkedMaps(), (defs) => ({
      ...defs,
      levelFields: [...defs.levelFields, { id: 'exit', type: 'ref', label: 'Exit', to: ['$level'] }],
    }))
    const linked = withLevel(project, 'inn', (level) => ({
      ...level,
      fields: { ...level.fields, exit: { target: 'map-1' } },
    }))
    const exit = worldLinks(linked, worldRects(linked, 'main', undefined)).find(
      (link) => link.label === 'Exit',
    )
    expect(exit).toMatchObject({
      from: 'inn',
      to: 'map-1',
      color: undefined,
      start: { x: 560, y: 120 },
      end: { x: 160, y: 120 },
    })
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
