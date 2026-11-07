import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { loadAuthored } from '../../testing/fixtures'
import { toyAfSector } from '../../testing/toy-af-sector'
import { afSectorCodec } from './af-codec'
import { afEntityKit } from './af-entities'

function depot(): AfSector {
  const result = afSectorCodec.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error(`the depot does not parse: ${JSON.stringify(result.issues)}`)
  return result.value
}

describe('afEntityKit', () => {
  it('reads the depot as two typed definitions and two things', () => {
    const kit = afEntityKit(depot())
    expect(kit.problems).toEqual([])
    expect(kit.definitions.map((def) => [def.id, def.shape])).toEqual([
      ['spawn', 'point'],
      ['crate', 'box'],
    ])
    expect(kit.definitions[0]?.single).toBe(true)
    expect(kit.definitions[1]?.size).toEqual([1, 1, 1])
    expect(kit.things).toEqual([
      { def: 'spawn', id: 'spawn', x: 1, z: 1, values: { facing: 0 } },
      { def: 'crate', id: 'crate1', x: 11, z: 2, values: { contents: 'tools' } },
    ])
  })

  it('reads a level with no entityDefs and no entities as an empty kit', () => {
    expect(afEntityKit(toyAfSector())).toEqual({ definitions: [], things: [], problems: [] })
  })

  it('says where a definition is wrong, in the file, and drops its things', () => {
    const level = toyAfSector({
      entityDefs: [{ id: 'crate', shape: 'cylinder', fields: [] }],
      entities: [{ def: 'crate', id: 'c1', x: 1, z: 1 }],
    })
    const kit = afEntityKit(level)
    expect(kit.definitions).toEqual([])
    expect(kit.things).toEqual([])
    expect(kit.problems.map((problem) => problem.path)).toEqual([
      ['entityDefs', 0, 'shape'],
      ['entities', 0, 'def'],
    ])
  })

  it('says an instance of a definition that is not there is not a thing', () => {
    const level = toyAfSector({
      entityDefs: [{ id: 'spawn', shape: 'point', fields: [] }],
      entities: [
        { def: 'spawn', id: 'spawn', x: 1, z: 1 },
        { def: 'lamp', id: 'l1', x: 2, z: 2 },
      ],
    })
    const kit = afEntityKit(level)
    expect(kit.things.map((thing) => thing.id)).toEqual(['spawn'])
    expect(kit.problems).toEqual([
      {
        path: ['entities', 1, 'def'],
        message: 'entity l1 is of definition lamp, which is not defined',
        entity: { def: 'lamp', id: 'l1', at: { x: 2, z: 2 } },
      },
    ])
  })

  it('says a value no field can hold is not one', () => {
    const level = toyAfSector({
      entityDefs: [{ id: 'crate', shape: 'box', size: [1, 1, 1], fields: [{ id: 'loot', type: 'text' }] }],
      entities: [{ def: 'crate', id: 'c1', x: 1, z: 1, loot: { a: { b: 1 } } }],
    })
    const kit = afEntityKit(level)
    expect(kit.things).toEqual([])
    expect(kit.problems.map((problem) => problem.path)).toEqual([['entities', 0, 'loot']])
  })

  it('does not change the level it reads', () => {
    const level = depot()
    const before = JSON.stringify(level)
    afEntityKit(level)
    expect(JSON.stringify(level)).toBe(before)
  })
})
