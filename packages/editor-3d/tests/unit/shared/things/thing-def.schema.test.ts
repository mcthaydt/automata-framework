import { describe, expect, it } from 'vitest'
import {
  RESERVED_FIELD_IDS,
  THING_SHAPES,
  THING_SITS,
  thingDefSchema,
} from '#src/shared/things/thing-def.schema.ts'

const spawn = {
  id: 'spawn',
  shape: 'point',
  single: true,
  fields: [{ id: 'facing', type: 'angle', default: 0 }],
}
const crate = {
  id: 'crate',
  shape: 'box',
  size: [1, 1, 1],
  fields: [
    {
      id: 'contents',
      type: 'enum',
      options: ['supplies', 'tools', 'empty'],
      default: 'supplies',
    },
  ],
}

/** Where each refusal is and what it says, `/` between the steps of a path. */
const refusals = (value: unknown): { path: string; message: string }[] => {
  const result = thingDefSchema.safeParse(value)
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path.join('/'), message: issue.message }))
}

describe('thingDefSchema', () => {
  it('names the shapes, the sits and the ids a thing keeps for itself', () => {
    expect(THING_SHAPES).toEqual(['point', 'box'])
    expect(THING_SITS).toEqual(['floor', 'free'])
    expect(RESERVED_FIELD_IDS).toEqual(['def', 'id', 'x', 'y', 'z'])
  })

  it('accepts the depot definitions as they are written', () => {
    expect(refusals(spawn)).toEqual([])
    expect(refusals(crate)).toEqual([])
    expect(thingDefSchema.parse(crate)).toEqual(crate)
  })

  it('keeps a member of the definition it does not know, and takes no such member in a field (the kit is strict there)', () => {
    const wider = { ...crate, note: 'carried' }
    expect(refusals(wider)).toEqual([])
    expect(thingDefSchema.parse(wider)).toEqual(wider)
    const typo = { ...crate, fields: [{ ...crate.fields[0], hint: 'not a member of a field' }] }
    expect(refusals(typo).map((issue) => issue.path)).toEqual(['fields/0'])
  })

  it('accepts a sit of floor or free, and a box sized by w, h and d fields', () => {
    expect(refusals({ ...spawn, sit: 'free' })).toEqual([])
    expect(refusals({ ...crate, sit: 'floor' })).toEqual([])
    const sized = {
      id: 'desk',
      shape: 'box',
      fields: ['w', 'h', 'd'].map((id) => ({ id, type: 'float', min: 0.01 })),
    }
    expect(refusals(sized)).toEqual([])
  })

  it('wants a shape that is point or box', () => {
    const { shape: _shape, ...without } = spawn
    expect(refusals(without).map((issue) => issue.path)).toEqual(['shape'])
    expect(refusals({ ...spawn, shape: 'cylinder' }).map((issue) => issue.path)).toEqual(['shape'])
  })

  it('refuses a sit that is not floor or free', () => {
    expect(refusals({ ...spawn, sit: 'float' }).map((issue) => issue.path)).toEqual(['sit'])
  })

  it('gives a point no size', () => {
    expect(refusals({ ...spawn, size: [1, 1, 1] })).toEqual([
      { path: 'size', message: 'a point has no size' },
    ])
  })

  it('says only that a point has no size, even when the size is also wrong', () => {
    expect(refusals({ ...spawn, size: [0, 1, 1] })).toEqual([
      { path: 'size', message: 'a point has no size' },
    ])
  })

  it('wants a size of three numbers above zero', () => {
    expect(refusals({ ...crate, size: [1, 1] }).map((issue) => issue.path)).toEqual(['size'])
    expect(refusals({ ...crate, size: [1, 'tall', 1] }).map((issue) => issue.path)).toEqual(['size/1'])
    for (const size of [
      [0, 1, 1],
      [1, -1, 1],
      [1, 1, 0],
    ])
      expect(refusals({ ...crate, size })).toEqual([
        { path: 'size', message: 'size is three numbers above zero (width, height, depth)' },
      ])
  })

  it('wants a box to have a size or float fields w, h and d for each box', () => {
    const lost = 'a box has a size, or float fields w, h and d that give each box its own'
    const { size: _size, ...unsized } = crate
    expect(refusals(unsized)).toEqual([{ path: 'shape', message: lost }])
    // Two of three is not enough, and an int field is not a float field.
    const two = ['w', 'h'].map((id) => ({ id, type: 'float' }))
    expect(refusals({ ...unsized, fields: two })).toEqual([{ path: 'shape', message: lost }])
    const integers = ['w', 'h', 'd'].map((id) => ({ id, type: 'int' }))
    expect(refusals({ ...unsized, fields: integers })).toEqual([{ path: 'shape', message: lost }])
  })

  it('refuses a field a thing keeps for itself, at that field', () => {
    for (const id of RESERVED_FIELD_IDS)
      expect(
        refusals({
          ...spawn,
          fields: [
            { id: 'facing', type: 'angle' },
            { id, type: 'float' },
          ],
        }),
      ).toEqual([
        {
          path: 'fields/1/id',
          message: `field ${id} is taken: a thing keeps def, id, x, y and z for itself`,
        },
      ])
  })

  it('refuses a point field until a point can say which plan axes it means', () => {
    expect(refusals({ ...spawn, fields: [{ id: 'path', type: 'point', list: true }] })).toEqual([
      {
        path: 'fields/0/type',
        message: 'field path is a point, and the plan has x and z: use two float fields',
      },
    ])
  })

  it("still holds the kit's rules, at the same places", () => {
    expect(refusals({ ...spawn, id: 'Spawn Point' }).map((issue) => issue.path)).toEqual([''])
    const twice = { ...spawn, fields: [spawn.fields[0], { id: 'facing', type: 'float' }] }
    expect(refusals(twice).map((issue) => issue.path)).toEqual(['fields/1'])
    const outside = { ...spawn, fields: [{ id: 'facing', type: 'int', min: 0, max: 3, default: 9 }] }
    expect(refusals(outside).map((issue) => issue.path)).toEqual(['fields/0'])
  })

  it("says every refusal it has, the kit's first, not only the first", () => {
    const bad = {
      id: 'Crate',
      shape: 'point',
      size: [1, 1, 1],
      fields: [{ id: 'x', type: 'point' }],
    }
    expect(refusals(bad).map((issue) => issue.path)).toEqual(['', 'size', 'fields/0/id', 'fields/0/type'])
  })

  it('accepts an area that names four different float fields, the sides of a rectangle (ED3D.7c)', () => {
    const sides = ['x0', 'z0', 'x1', 'z1'].map((id) => ({ id, type: 'float' }))
    const region = { id: 'region', shape: 'point', area: ['x0', 'z0', 'x1', 'z1'], fields: sides }
    expect(refusals(region)).toEqual([])
    expect(thingDefSchema.parse(region).area).toEqual(['x0', 'z0', 'x1', 'z1'])
  })

  it('refuses an area whose names are not four different float fields of the definition, at the area', () => {
    const wrong =
      'area names four different float fields of the definition: the x0, z0, x1 and z1 of a rectangle'
    const sides = ['x0', 'z0', 'x1', 'z1'].map((id) => ({ id, type: 'float' }))
    const region = { id: 'region', shape: 'point', fields: sides }
    expect(refusals({ ...region, area: ['x0', 'z0', 'x1', 'gone'] })).toEqual([
      { path: 'area', message: wrong },
    ])
    expect(refusals({ ...region, area: ['x0', 'z0', 'x1', 'x1'] })).toEqual([
      { path: 'area', message: wrong },
    ])
    const integer = { ...region, fields: [...sides.slice(0, 3), { id: 'z1', type: 'int' }] }
    expect(refusals({ ...integer, area: ['x0', 'z0', 'x1', 'z1'] })).toEqual([
      { path: 'area', message: wrong },
    ])
    expect(refusals({ ...region, area: ['x0', 'z0', 'x1'] }).map((issue) => issue.path)).toEqual(['area'])
  })
})
