// The entity check (ED3D.2b-1): what is wrong with the things of a level, seeded into the toy AF level and the toy
// blockout, and the shipped files that must pass.
import { describe, expect, it } from 'vitest'
import type { AfEntity, AfEntityDef, AfSector } from '../format/af-sector.schema'
import { resolveMap } from '../geometry/sectors'
import { afEntityKit } from '../profile/af-sector/af-entities'
import { buildSectors } from '../profile/af-sector/build'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightEntityKit } from '../profile/last-light-entities'
import { lastLightProfile } from '../profile/last-light-profile'
import { loadAuthored, loadFixture } from '../testing/fixtures'
import { toyAfSector, toyHall } from '../testing/toy-af-sector'
import { must } from '../testing/toy-blockout'
import { entityProblems } from './entities'

const crate: AfEntityDef = {
  id: 'crate',
  shape: 'box',
  size: [1, 1, 1],
  fields: [
    { id: 'weight', type: 'int', min: 0, max: 3 },
    { id: 'contents', type: 'enum', options: ['supplies', 'tools'], default: 'supplies' },
    { id: 'loot', type: 'text', required: true },
  ],
}
const spawn: AfEntityDef = { id: 'spawn', shape: 'point', single: true, fields: [] }

const crateAt = (id: string, x: number, z: number, more: Record<string, unknown> = {}): AfEntity => ({
  def: 'crate',
  id,
  x,
  z,
  loot: 'key',
  ...more,
})

/** The problems of an AF level whose hall is 0..8 by 0..6 and whose dock lies east of it. */
function check(entityDefs: AfEntityDef[], entities: AfEntity[], more: Partial<AfSector> = {}) {
  const level = toyAfSector({ entityDefs, entities, ...more })
  return entityProblems(afEntityKit(level), resolveMap(buildSectors(level)))
}

describe('entityProblems: values', () => {
  it('passes a level whose things fit their definitions', () => {
    expect(check([crate, spawn], [crateAt('c1', 2, 2, { weight: 2, contents: 'tools' })])).toEqual([])
  })

  it('says a value above its field’s bound, at the thing', () => {
    expect(check([crate], [crateAt('c1', 2, 3, { weight: 9 })])).toEqual([
      {
        message: 'entity c1: weight must be at most 3',
        locator: { selection: 'entity:crate/c1', at: { x: 2, z: 3 } },
      },
    ])
  })

  it('says a value that is not one of the options', () => {
    expect(check([crate], [crateAt('c1', 2, 2, { contents: 'xyz' })]).map((p) => p.message)).toEqual([
      'entity c1: contents has no option "xyz"',
    ])
  })

  it('says a required field that is missing, and a value of the wrong type', () => {
    const missing: AfEntity = { def: 'crate', id: 'c1', x: 2, z: 2 }
    expect(check([crate], [missing]).map((p) => p.message)).toEqual(['entity c1: loot is required'])
    expect(check([crate], [crateAt('c2', 2, 2, { weight: 'heavy' })]).map((p) => p.message)).toEqual([
      'entity c2: weight must be a finite number',
    ])
  })

  it('says a member that is not a field of the definition', () => {
    expect(check([crate], [crateAt('c1', 2, 2, { tint: 'red' })]).map((p) => p.message)).toEqual([
      'entity c1: tint is not a field of this entity',
    ])
  })

  it('says every problem a thing has, in the order of the definition’s fields', () => {
    const bad = crateAt('c1', 2, 2, { weight: 9, contents: 'xyz', tint: 'red' })
    expect(check([crate], [bad]).map((p) => p.message)).toEqual([
      'entity c1: weight must be at most 3',
      'entity c1: contents has no option "xyz"',
      'entity c1: tint is not a field of this entity',
    ])
  })
})

describe('entityProblems: what could not be read', () => {
  it('keeps the reader’s sentence and locates a thing of an undefined definition', () => {
    const stray: AfEntity = { def: 'lamp', id: 'l1', x: 2, z: 2 }
    expect(check([crate], [stray])).toEqual([
      {
        message: 'entity l1 is of definition lamp, which is not defined',
        locator: { selection: 'entity:lamp/l1', at: { x: 2, z: 2 } },
      },
    ])
  })

  it('gives a definition’s problem no place, since a definition cannot be selected', () => {
    const [problem] = check([{ ...crate, shape: 'cylinder' } as AfEntityDef], [])
    expect(problem?.message).toMatch(/shape/)
    expect(problem?.locator).toBeUndefined()
  })

  it('reports a thing whose name cannot be a selection id without a place, and does not fail on it', () => {
    const [problem] = check([crate], [crateAt('a/b', 2, 2, { weight: 9 })])
    expect(problem?.message).toBe('entity a/b: weight must be at most 3')
    expect(problem?.locator).toBeUndefined()
  })
})

describe('entityProblems: places', () => {
  it('says a thing outside every sector, and passes one in either room', () => {
    expect(check([crate], [crateAt('c1', 50, 50)])).toEqual([
      {
        message: 'entity c1 is outside every sector',
        locator: { selection: 'entity:crate/c1', at: { x: 50, z: 50 } },
      },
    ])
    expect(check([crate], [crateAt('c1', 2, 2), crateAt('c2', 11, 3)])).toEqual([])
  })

  it('says a thing standing in a hole of a sector is outside it', () => {
    const holed = {
      ...toyHall,
      holes: [
        [
          [2, 2],
          [4, 2],
          [4, 4],
          [2, 4],
        ] as const,
      ],
    }
    const entities = [crateAt('c1', 3, 3), crateAt('c2', 1, 1)]
    const problems = check([crate], entities, { sectors: [holed, ...toyAfSector().sectors.slice(1)] })
    expect(problems.map((p) => p.message)).toEqual(['entity c1 is outside every sector'])
  })
})

describe('entityProblems: single definitions', () => {
  it('says the later thing of a single definition, with the first beside it', () => {
    const entities: AfEntity[] = [
      { def: 'spawn', id: 's1', x: 1, z: 1 },
      { def: 'spawn', id: 's2', x: 2, z: 2 },
      { def: 'spawn', id: 's3', x: 3, z: 3 },
    ]
    expect(check([spawn], entities)).toEqual([
      {
        message: 'spawn allows one: entity s2 is another',
        locator: { selection: 'entity:spawn/s2', at: { x: 2, z: 2 } },
        related: [{ selection: 'entity:spawn/s1', at: { x: 1, z: 1 } }],
      },
      {
        message: 'spawn allows one: entity s3 is another',
        locator: { selection: 'entity:spawn/s3', at: { x: 3, z: 3 } },
        related: [{ selection: 'entity:spawn/s1', at: { x: 1, z: 1 } }],
      },
    ])
  })

  it('allows as many as it likes of a definition that is not single', () => {
    expect(check([crate], [crateAt('c1', 1, 1), crateAt('c2', 2, 2)])).toEqual([])
  })
})

describe('entityProblems: order', () => {
  it('says what could not be read first, then each thing’s values and place in file order, then the single ones', () => {
    const entities: AfEntity[] = [
      { def: 'spawn', id: 's1', x: 1, z: 1 },
      crateAt('c1', 50, 50, { weight: 9 }),
      { def: 'spawn', id: 's2', x: 2, z: 2 },
      { def: 'lamp', id: 'l1', x: 2, z: 2 },
    ]
    expect(check([crate, spawn], entities).map((p) => p.message)).toEqual([
      'entity l1 is of definition lamp, which is not defined',
      'entity c1: weight must be at most 3',
      'entity c1 is outside every sector',
      'spawn allows one: entity s2 is another',
    ])
  })
})

describe('entityProblems: the shipped levels', () => {
  it('passes the depot', () => {
    const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
    if (!result.ok) throw new Error('the depot does not parse')
    const map = must(afSectorProfile.geometry(result.value).layers[0])
    if (map.kind !== 'sectors') throw new Error('the depot has no sectors')
    expect(entityProblems(afSectorProfile.entities(result.value), map.map)).toEqual([])
  })

  it.each(['blockout-clinic', 'blockout-clinic-dawn', 'blockout-bay', 'blockout-prologue'] as const)(
    'passes %s, with every thing of Last Light’s fixed set inside a sector and fitting its field',
    (name) => {
      const result = lastLightProfile.parse(loadFixture(name))
      if (!result.ok) throw new Error(`${name} does not parse`)
      const layer = must(lastLightProfile.geometry(result.value).layers[0])
      if (layer.kind !== 'sectors') throw new Error('no sectors')
      expect(entityProblems(lastLightEntityKit(result.value), layer.map)).toEqual([])
    },
  )
})
