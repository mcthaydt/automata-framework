import { describe, expect, it } from 'vitest'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { entity, withEntities } from '../../testing/project-edit'
import { counterIds } from '../ids'
import type { EntityDef2D, EntityInstance, Project } from '../project-types'
import { entityAt, entityBounds } from './entity-geometry'

const project = (): Project => platformerTemplate.create(counterIds())
const def = (id: string): EntityDef2D => {
  const found = project().defs.entities.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`no definition ${id}`)
  return found
}
const ENTITIES = { level: 'level-1', layer: 'entities' }

describe('entityBounds', () => {
  it('puts a rect with a bottom-centre pivot above and to both sides of its position', () => {
    const slime = def('slime') // 16 × 12, pivot (0.5, 1)
    expect(entityBounds(slime, entity('a', 'slime', 100, 200))).toEqual({ x: 92, y: 188, w: 16, h: 12 })
  })

  it('puts a top-left pivot at the position', () => {
    const platform = def('moving-platform') // 48 × 8, pivot (0, 0)
    expect(entityBounds(platform, entity('a', 'moving-platform', 10, 20))).toEqual({
      x: 10,
      y: 20,
      w: 48,
      h: 8,
    })
  })

  it('centres a centre pivot', () => {
    const coin = def('coin') // 8 × 8, pivot (0.5, 0.5)
    expect(entityBounds(coin, entity('a', 'coin', 50, 50))).toEqual({ x: 46, y: 46, w: 8, h: 8 })
  })

  it("uses the instance's own size when it has one, and the pivot scales with it", () => {
    const platform = { ...def('moving-platform'), pivot: { x: 0.5, y: 0.5 } }
    const wide: EntityInstance = { ...entity('a', 'moving-platform', 100, 100), w: 96, h: 16 }
    expect(entityBounds(platform, wide)).toEqual({ x: 52, y: 92, w: 96, h: 16 })
  })

  it('falls back to the definition for a missing width or height separately', () => {
    const platform = def('moving-platform')
    expect(entityBounds(platform, { ...entity('a', 'moving-platform', 0, 0), w: 100 })).toEqual({
      x: 0,
      y: 0,
      w: 100,
      h: 8,
    })
    expect(entityBounds(platform, { ...entity('a', 'moving-platform', 0, 0), h: 20 })).toEqual({
      x: 0,
      y: 0,
      w: 48,
      h: 20,
    })
  })

  it('gives a point shape the size of its definition, so it can be hit', () => {
    const point: EntityDef2D = { ...def('coin'), shape: 'point', size: { w: 6, h: 6 } }
    expect(entityBounds(point, entity('a', 'coin', 10, 10))).toEqual({ x: 7, y: 7, w: 6, h: 6 })
  })
})

describe('entityAt', () => {
  const placed = (): Project =>
    withEntities(project(), 'level-1', [
      entity('under', 'slime', 100, 200),
      entity('over', 'slime', 104, 200),
      entity('far', 'coin', 300, 100),
    ])

  it('finds the instance whose bounds contain the point', () => {
    expect(entityAt(placed(), ENTITIES, { x: 300, y: 100 })?.id).toBe('far')
  })

  it('picks the topmost of two overlapping instances: the last in the layer', () => {
    expect(entityAt(placed(), ENTITIES, { x: 102, y: 195 })?.id).toBe('over')
    expect(entityAt(placed(), ENTITIES, { x: 93, y: 195 })?.id).toBe('under')
  })

  it('includes the top-left edge and excludes the bottom-right edge', () => {
    const only = withEntities(project(), 'level-1', [entity('a', 'slime', 100, 200)]) // bounds x 92..108, y 188..200
    expect(entityAt(only, ENTITIES, { x: 92, y: 188 })?.id).toBe('a')
    expect(entityAt(only, ENTITIES, { x: 108, y: 195 })).toBeUndefined()
    expect(entityAt(only, ENTITIES, { x: 100, y: 200 })).toBeUndefined()
    expect(entityAt(only, ENTITIES, { x: 91.9, y: 195 })).toBeUndefined()
    expect(entityAt(only, ENTITIES, { x: 100, y: 187.9 })).toBeUndefined()
  })

  it('finds nothing at an empty point', () => {
    expect(entityAt(placed(), ENTITIES, { x: 0, y: 0 })).toBeUndefined()
  })

  it('skips an instance whose definition is gone instead of failing', () => {
    const broken = withEntities(project(), 'level-1', [entity('ghost', 'dragon', 50, 50)])
    expect(entityAt(broken, ENTITIES, { x: 50, y: 50 })).toBeUndefined()
  })

  it('answers nothing for a layer that holds no entities', () => {
    expect(entityAt(placed(), { level: 'level-1', layer: 'collision' }, { x: 100, y: 195 })).toBeUndefined()
  })

  it('throws for a level or layer that does not exist', () => {
    expect(() => entityAt(placed(), { level: 'nowhere', layer: 'entities' }, { x: 0, y: 0 })).toThrow(
      RangeError,
    )
  })
})
