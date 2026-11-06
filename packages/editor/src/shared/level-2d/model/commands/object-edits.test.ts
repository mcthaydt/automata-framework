import { describe, expect, it } from 'vitest'
import { hollowmere } from '../../../../testing/level-2d/samples'
import type { ObjectInstance, Project } from '../project-types'
import { tilesetTiles } from '../tileset-grid'
import { deleteObject, flipObject, moveObject, placeObject } from './object-edits'

const PROPS = { level: 'village', layer: 'props' }
const project = (): Project => hollowmere()
const objectsOf = (p: Project): readonly ObjectInstance[] => {
  const found = p.levels
    .find((level) => level.id === 'village')
    ?.layers.find((layer) => layer.def === 'props')
  return found?.kind === 'objects' ? found.items : []
}
const first = (p: Project): ObjectInstance => {
  const found = objectsOf(p)[0]
  if (found === undefined) throw new Error('the sample has no object')
  return found
}
const tileCount = (p: Project): number => {
  const tileset = p.defs.tilesets.find((candidate) => candidate.id === 'overworld')
  return tileset === undefined ? 0 : tilesetTiles(tileset).count
}

describe('placeObject', () => {
  it('appends an object with its flips off unless asked', () => {
    const next = placeObject(project(), PROPS, { id: 'tree-9', tile: 26, x: 40, y: 50 })
    expect(objectsOf(next).at(-1)).toEqual({
      id: 'tree-9',
      tile: 26,
      x: 40,
      y: 50,
      flipX: false,
      flipY: false,
    })
    expect(objectsOf(next)).toHaveLength(objectsOf(project()).length + 1)
  })

  it('keeps the flips it is given', () => {
    const next = placeObject(project(), PROPS, { id: 'a', tile: 26, x: 0, y: 0, flipX: true })
    expect(objectsOf(next).at(-1)).toMatchObject({ flipX: true, flipY: false })
    const other = placeObject(project(), PROPS, { id: 'a', tile: 26, x: 0, y: 0, flipY: true })
    expect(objectsOf(other).at(-1)).toMatchObject({ flipX: false, flipY: true })
  })

  it('rounds the position to whole pixels', () => {
    const next = placeObject(project(), PROPS, { id: 'a', tile: 26, x: 10.5, y: 3.4 })
    expect(objectsOf(next).at(-1)).toMatchObject({ x: 11, y: 3 })
  })

  it('accepts the last tile of the tileset and refuses the one after it', () => {
    const count = tileCount(project())
    expect(count).toBeGreaterThan(0)
    expect(() => placeObject(project(), PROPS, { id: 'a', tile: count - 1, x: 0, y: 0 })).not.toThrow()
    expect(() => placeObject(project(), PROPS, { id: 'a', tile: count, x: 0, y: 0 })).toThrow(
      new RangeError(`tile ${count} is beyond tileset "overworld", which has ${count} tiles`),
    )
    expect(() => placeObject(project(), PROPS, { id: 'a', tile: -1, x: 0, y: 0 })).toThrow(RangeError)
    expect(() => placeObject(project(), PROPS, { id: 'a', tile: 1.5, x: 0, y: 0 })).toThrow(RangeError)
  })

  it('refuses an id that any object or entity in the project uses', () => {
    const taken = first(project()).id
    expect(() => placeObject(project(), PROPS, { id: taken, tile: 26, x: 0, y: 0 })).toThrow(
      new RangeError(`object id "${taken}" is already used`),
    )
  })

  it('refuses a layer that holds no objects, naming it', () => {
    expect(() =>
      placeObject(project(), { level: 'village', layer: 'entities' }, { id: 'a', tile: 26, x: 0, y: 0 }),
    ).toThrow(new RangeError('layer "entities" has no objects'))
  })
})

describe('moveObject', () => {
  it('moves one object and keeps its tile and flips', () => {
    const before = first(project())
    const next = moveObject(project(), PROPS, before.id, 77, 88)
    expect(objectsOf(next)[0]).toEqual({ ...before, x: 77, y: 88 })
  })

  it('rounds, and returns the same project for the place it is already in', () => {
    const p = project()
    const object = first(p)
    expect(moveObject(p, PROPS, object.id, object.x + 0.2, object.y - 0.2)).toBe(p)
    expect(objectsOf(moveObject(p, PROPS, object.id, 10.6, 20.4))[0]).toMatchObject({ x: 11, y: 20 })
  })

  it('moves along one axis alone', () => {
    const p = project()
    const object = first(p)
    expect(objectsOf(moveObject(p, PROPS, object.id, object.x, 5))[0]).toMatchObject({ x: object.x, y: 5 })
    expect(objectsOf(moveObject(p, PROPS, object.id, 5, object.y))[0]).toMatchObject({ x: 5, y: object.y })
  })

  it('refuses an object that is not in the layer', () => {
    expect(() => moveObject(project(), PROPS, 'ghost', 0, 0)).toThrow(
      new RangeError('no object "ghost" in layer "props"'),
    )
  })
})

describe('flipObject', () => {
  it('toggles one axis and leaves the other', () => {
    const p = project()
    const object = first(p)
    const x = objectsOf(flipObject(p, PROPS, object.id, 'x'))[0]
    expect(x).toMatchObject({ flipX: !object.flipX, flipY: object.flipY })
    const y = objectsOf(flipObject(p, PROPS, object.id, 'y'))[0]
    expect(y).toMatchObject({ flipX: object.flipX, flipY: !object.flipY })
  })

  it('twice is the identity', () => {
    const p = project()
    const object = first(p)
    for (const axis of ['x', 'y'] as const) {
      const twice = flipObject(flipObject(p, PROPS, object.id, axis), PROPS, object.id, axis)
      expect(objectsOf(twice)[0]).toEqual(object)
    }
  })

  it('refuses an object that is not in the layer', () => {
    expect(() => flipObject(project(), PROPS, 'ghost', 'x')).toThrow(RangeError)
  })
})

describe('every object edit', () => {
  const entities = { level: 'village', layer: 'entities' }
  it('refuses a layer that holds no objects', () => {
    const message = new RangeError('layer "entities" has no objects')
    expect(() => moveObject(project(), entities, 'a', 0, 0)).toThrow(message)
    expect(() => flipObject(project(), entities, 'a', 'x')).toThrow(message)
    expect(() => deleteObject(project(), entities, 'a')).toThrow(message)
  })

  it('refuses a layer whose tileset is missing from the definitions', () => {
    const p = project()
    const broken = { ...p, defs: { ...p.defs, tilesets: [] } }
    expect(() => placeObject(broken, PROPS, { id: 'a', tile: 1, x: 0, y: 0 })).toThrow(
      new RangeError('layer "props" uses tileset "overworld", which is missing'),
    )
  })
})

describe('deleteObject', () => {
  it('removes the object and keeps the order of the others', () => {
    const p = project()
    const [gone, ...rest] = objectsOf(p)
    const next = deleteObject(p, PROPS, (gone as ObjectInstance).id)
    expect(objectsOf(next)).toEqual(rest)
  })

  it('refuses an object that is not in the layer', () => {
    expect(() => deleteObject(project(), PROPS, 'ghost')).toThrow(
      new RangeError('no object "ghost" in layer "props"'),
    )
  })
})
