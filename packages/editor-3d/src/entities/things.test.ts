import { describe, expect, it } from 'vitest'
import { readEntityKit } from './things'

const spawnDef = {
  id: 'spawn',
  shape: 'point',
  single: true,
  fields: [{ id: 'facing', type: 'angle', default: 0 }],
}
const crateDef = {
  id: 'crate',
  shape: 'box',
  size: [1, 1, 1],
  fields: [{ id: 'contents', type: 'enum', options: ['supplies', 'tools'], default: 'supplies' }],
}

const defs = (...values: unknown[]) => values.map((value, index) => ({ path: ['entityDefs', index], value }))
const things = (...values: unknown[]) => values.map((value, index) => ({ path: ['entities', index], value }))

const read = (definitions: unknown[], instances: unknown[]) =>
  readEntityKit({ definitions: defs(...definitions), instances: things(...instances) })

describe('readEntityKit', () => {
  it('reads nothing as nothing', () => {
    expect(readEntityKit({ definitions: [], instances: [] })).toEqual({
      definitions: [],
      things: [],
      problems: [],
    })
  })

  it('gives the definitions as typed and each thing with its place and the values beside it', () => {
    const kit = read(
      [spawnDef, crateDef],
      [
        { def: 'spawn', id: 'spawn', x: 1, z: 2, facing: 90 },
        { def: 'crate', id: 'crate1', x: 11, y: 0.5, z: 2, contents: 'tools' },
      ],
    )
    expect(kit.problems).toEqual([])
    expect(kit.definitions).toEqual([spawnDef, crateDef])
    expect(kit.things).toEqual([
      { def: 'spawn', id: 'spawn', x: 1, z: 2, values: { facing: 90 } },
      { def: 'crate', id: 'crate1', x: 11, y: 0.5, z: 2, values: { contents: 'tools' } },
    ])
  })

  it('leaves y out of a thing that has none, and keeps the values in the order the file has them', () => {
    const kit = read([crateDef], [{ def: 'crate', id: 'a', contents: 'tools', z: 1, x: 2, extra: 3 }])
    const [thing] = kit.things
    expect(thing).toBeDefined()
    expect('y' in (thing ?? {})).toBe(false)
    expect(Object.keys(thing?.values ?? {})).toEqual(['contents', 'extra'])
  })

  it('keeps the things in file order, whatever their definition', () => {
    const kit = read(
      [spawnDef, crateDef],
      [
        { def: 'crate', id: 'c2', x: 0, z: 0 },
        { def: 'spawn', id: 's', x: 0, z: 0 },
        { def: 'crate', id: 'c1', x: 0, z: 0 },
      ],
    )
    expect(kit.things.map((thing) => thing.id)).toEqual(['c2', 's', 'c1'])
  })

  it('says why a definition is not one, at its own path, and the things of it are then not defined', () => {
    const kit = read(
      [spawnDef, { ...crateDef, shape: 'cylinder' }],
      [{ def: 'crate', id: 'crate1', x: 0, z: 0 }],
    )
    expect(kit.definitions).toEqual([spawnDef])
    expect(kit.problems.map((problem) => problem.path)).toEqual([
      ['entityDefs', 1, 'shape'],
      ['entities', 0, 'def'],
    ])
    expect(kit.problems[1]?.message).toBe('entity crate1 is of definition crate, which is not defined')
  })

  it("carries the 3D rules' own sentences", () => {
    const kit = read([{ ...spawnDef, fields: [{ id: 'x', type: 'float' }] }], [])
    expect(kit.problems).toEqual([
      {
        path: ['entityDefs', 0, 'fields', 0, 'id'],
        message: 'entity definition spawn: field x is taken: a thing keeps def, id, x, y and z for itself',
      },
    ])
  })

  it('says which definition a problem is about, with the member when the schema, not a rule, found it', () => {
    const kit = read(
      [{ ...crateDef, shape: 'cylinder' }, { id: 'lamp', fields: [] }, null, { shape: 'point' }],
      [],
    )
    expect(kit.problems.map((problem) => problem.message.replace(/: Invalid .*$/, ': Invalid'))).toEqual([
      'entity definition crate: shape: Invalid',
      'entity definition lamp: shape: Invalid',
      'entity definition #2: Invalid',
      'entity definition #3: id: Invalid',
      'entity definition #3: fields: Invalid',
    ])
  })

  it('takes the first of two definitions with one id and leaves the second to the ids check', () => {
    const kit = read([crateDef, { ...crateDef, shape: 'point', size: undefined }], [])
    expect(kit.definitions).toEqual([crateDef])
    expect(kit.problems).toEqual([])
  })

  it('says what is wrong with an instance, at the member that is', () => {
    const kit = read(
      [crateDef],
      [
        { def: 'crate', id: 'c1', x: '3', z: 1 },
        { def: 'crate', id: 'c2', x: 3 },
        { def: 'crate', x: 3, z: 1 },
        { id: 'c4', x: 3, z: 1 },
        { def: 'crate', id: 'c5', x: 3, z: 1, y: 'high' },
      ],
    )
    expect(kit.things).toEqual([])
    expect(kit.problems.map((problem) => problem.path)).toEqual([
      ['entities', 0, 'x'],
      ['entities', 1, 'z'],
      ['entities', 2, 'id'],
      ['entities', 3, 'def'],
      ['entities', 4, 'y'],
    ])
    expect(kit.problems[0]?.message).toMatch(/^entity c1: x: /)
    expect(kit.problems[2]?.message).toMatch(/^entity #2: id: /)
  })

  it('says an entity that is not an object is not one', () => {
    const kit = read([crateDef], [null, 4, 'crate', ['crate']])
    expect(kit.things).toEqual([])
    expect(kit.problems).toEqual(
      [0, 1, 2, 3].map((index) => ({
        path: ['entities', index],
        message: 'an entity is an object with def, id, x and z',
      })),
    )
  })

  it('says a value that no field can hold is not a field value, at its member, and the thing is not one', () => {
    const kit = read(
      [crateDef],
      [
        { def: 'crate', id: 'c1', x: 0, z: 0, contents: { deep: { no: 1 } } },
        { def: 'crate', id: 'c2', x: 0, z: 0, contents: 'tools' },
      ],
    )
    expect(kit.things.map((thing) => thing.id)).toEqual(['c2'])
    expect(kit.problems).toEqual([
      {
        path: ['entities', 0, 'contents'],
        message: 'entity c1: contents is not a value a field can hold',
        entity: { def: 'crate', id: 'c1', at: { x: 0, z: 0 } },
      },
    ])
  })

  it('does not let a member called __proto__ change what the values are', () => {
    const wild = JSON.parse('{"def":"crate","id":"c","x":0,"z":0,"__proto__":{"polluted":true}}')
    const values = read([crateDef], [wild]).things[0]?.values ?? {}
    expect(Object.getPrototypeOf(values)).toBe(Object.prototype)
    expect('polluted' in values).toBe(false)
  })

  it('takes every shape of value the kit defines', () => {
    const values = {
      a: 1,
      b: true,
      c: 'text',
      d: { x: 1, y: 2 },
      e: { target: 'crate1' },
      f: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    }
    const kit = read([crateDef], [{ def: 'crate', id: 'c', x: 0, z: 0, ...values }])
    expect(kit.problems).toEqual([])
    expect(kit.things[0]?.values).toEqual(values)
  })

  it('lists the definitions problems first and then the instances, each in file order', () => {
    const kit = read(
      [
        { ...crateDef, shape: 'cylinder' },
        { ...spawnDef, sit: 'float' },
      ],
      [
        { def: 'crate', id: 'c1', x: 0, z: 0 },
        { def: 'nothing', id: 'n', x: 0, z: 0 },
      ],
    )
    expect(kit.problems.map((problem) => problem.path)).toEqual([
      ['entityDefs', 0, 'shape'],
      ['entityDefs', 1, 'sit'],
      ['entities', 0, 'def'],
      ['entities', 1, 'def'],
    ])
  })

  it('says which entity a problem is about, and where it stands when it has a place', () => {
    const kit = read(
      [crateDef],
      [
        { def: 'nothing', id: 'n', x: 1, z: 2 },
        { def: 'crate', id: 'c', x: 3, z: 4, contents: { deep: { no: 1 } } },
        { def: 'crate', id: 'c1', x: '3', z: 1 },
        { def: 'crate', id: 'c2', x: 3 },
      ],
    )
    expect(kit.problems.map((problem) => problem.entity)).toEqual([
      { def: 'nothing', id: 'n', at: { x: 1, z: 2 } },
      { def: 'crate', id: 'c', at: { x: 3, z: 4 } },
      { def: 'crate', id: 'c1' },
      { def: 'crate', id: 'c2' },
    ])
    expect('at' in (kit.problems[2]?.entity ?? {})).toBe(false)
  })

  it('names no entity for a problem of a definition, or of an instance with no def and id to name it by', () => {
    const kit = read(
      [{ ...crateDef, shape: 'cylinder' }],
      [{ def: 'crate', x: 3, z: 1 }, { id: 'c4', x: 3, z: 1 }, { def: 5, id: 'c5', x: 3, z: 1 }, 'crate'],
    )
    expect(kit.problems).toHaveLength(5)
    for (const problem of kit.problems) expect('entity' in problem, problem.message).toBe(false)
  })

  it('never throws, whatever it is given', () => {
    const rubbish = [undefined, null, 0, '', [], {}, { id: 5 }, { def: {}, id: [] }, () => 1]
    expect(() => read(rubbish, rubbish)).not.toThrow()
    expect(read(rubbish, rubbish).things).toEqual([])
  })
})
