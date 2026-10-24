// The ref half of `ids` (ED3D.2b-1): a ref field must point at a thing or a sector the level has, as its `to` allows,
// and a `to` must name only what a definition or `$sector` can be. Seeded into the toy AF level (sectors `hall`, `dock`).
import type { FieldDef } from '@mcthaydt/automata-editor-kit/fields'
import { describe, expect, it } from 'vitest'
import type { AfEntity, AfEntityDef } from '../format/af-sector.schema'
import { afEntityKit } from '../profile/af-sector/af-entities'
import { toyAfSector } from '../testing/toy-af-sector'
import { entityRefProblems } from './entity-refs'

const crate: AfEntityDef = { id: 'crate', shape: 'box', size: [1, 1, 1], fields: [] }
const lamp: AfEntityDef = { id: 'lamp', shape: 'point', fields: [] }

const switchWith = (...fields: FieldDef[]): AfEntityDef => ({
  id: 'switch',
  shape: 'point',
  fields,
})

const at = (def: string, id: string, x: number, z: number, more: Record<string, unknown> = {}): AfEntity => ({
  def,
  id,
  x,
  z,
  ...more,
})

const ref = (target: string, container?: string) =>
  container === undefined ? { target } : { target, container }

/** The ref problems of an AF level made of these definitions and things. */
function check(entityDefs: AfEntityDef[], entities: AfEntity[]) {
  const level = toyAfSector({ entityDefs, entities })
  return entityRefProblems(
    afEntityKit(level),
    level.sectors.map((sector) => sector.id),
  )
}

const opens = switchWith({ id: 'opens', type: 'ref', to: ['crate'] })

describe('entityRefProblems: what a ref may point at', () => {
  it('passes refs that point at a thing of the allowed definition, a sector, or either', () => {
    const def = switchWith(
      { id: 'opens', type: 'ref', to: ['crate'] },
      { id: 'room', type: 'ref', to: ['$sector'] },
      { id: 'either', type: 'ref', to: ['crate', '$sector'] },
      { id: 'anything', type: 'ref' },
    )
    const things = [
      at('crate', 'c1', 1, 1),
      at('lamp', 'l1', 2, 2),
      at('switch', 's1', 3, 3, {
        opens: ref('c1'),
        room: ref('dock'),
        either: ref('hall'),
        anything: ref('l1'),
      }),
      at('switch', 's2', 4, 4, { either: ref('c1'), anything: ref('dock') }),
    ]
    expect(check([crate, lamp, def], things)).toEqual([])
  })

  it('says a ref to a thing that is not there, at the thing that holds it', () => {
    expect(
      check([crate, opens], [at('crate', 'c1', 1, 1), at('switch', 's1', 3, 4, { opens: ref('c9') })]),
    ).toEqual([
      {
        message: 'entity s1: opens points at c9, which is no crate',
        locator: { selection: 'entity:switch/s1', at: { x: 3, z: 4 } },
      },
    ])
  })

  it('does not take a thing of another definition for the allowed one, but takes it when any thing is allowed', () => {
    const things = [at('lamp', 'l1', 1, 1), at('switch', 's1', 3, 3, { opens: ref('l1') })]
    expect(check([crate, lamp, opens], things).map((p) => p.message)).toEqual([
      'entity s1: opens points at l1, which is no crate',
    ])
    const anything = switchWith({ id: 'opens', type: 'ref' })
    expect(check([crate, lamp, anything], things)).toEqual([])
  })

  it('does not take a thing for a sector when only sectors are allowed, nor a sector for a thing', () => {
    const def = switchWith(
      { id: 'room', type: 'ref', to: ['$sector'] },
      { id: 'opens', type: 'ref', to: ['crate'] },
    )
    const things = [
      at('crate', 'c1', 1, 1),
      at('switch', 's1', 3, 3, { room: ref('c1'), opens: ref('hall') }),
    ]
    expect(check([crate, def], things).map((p) => p.message)).toEqual([
      'entity s1: room points at c1, which is no sector',
      'entity s1: opens points at hall, which is no crate',
    ])
  })

  it('says `thing or sector` for a ref that may point at anything, whether `to` is absent or empty', () => {
    const things = [at('switch', 's1', 3, 3, { a: ref('nowhere'), b: ref('nowhere') })]
    const def = switchWith({ id: 'a', type: 'ref' }, { id: 'b', type: 'ref', to: [] })
    expect(check([def], things).map((p) => p.message)).toEqual([
      'entity s1: a points at nowhere, which is no thing or sector',
      'entity s1: b points at nowhere, which is no thing or sector',
    ])
  })

  it('names what is allowed in the sentence: one name, two, or three', () => {
    const def = switchWith(
      { id: 'one', type: 'ref', to: ['crate'] },
      { id: 'two', type: 'ref', to: ['crate', '$sector'] },
      { id: 'three', type: 'ref', to: ['crate', 'lamp', '$sector'] },
    )
    const things = [at('switch', 's1', 3, 3, { one: ref('x'), two: ref('x'), three: ref('x') })]
    expect(check([crate, lamp, def], things).map((p) => p.message)).toEqual([
      'entity s1: one points at x, which is no crate',
      'entity s1: two points at x, which is no crate or sector',
      'entity s1: three points at x, which is no crate, lamp or sector',
    ])
  })

  it('does not look at the container: a level is one file, so a target is a thing or a sector of it', () => {
    const things = [at('crate', 'c1', 1, 1), at('switch', 's1', 3, 3, { opens: ref('c1', 'elsewhere') })]
    expect(check([crate, opens], things)).toEqual([])
  })
})

describe('entityRefProblems: lists of refs', () => {
  const route = switchWith({ id: 'route', type: 'ref', list: true, to: ['crate'] })

  it('says each item that points at nothing, by its place in the list', () => {
    const things = [
      at('crate', 'c1', 1, 1),
      at('switch', 's1', 3, 3, { route: [ref('c1'), ref('c7'), ref('c1'), ref('c8')] }),
    ]
    expect(check([crate, route], things)).toEqual([
      {
        message: 'entity s1: route item 1 points at c7, which is no crate',
        locator: { selection: 'entity:switch/s1', at: { x: 3, z: 3 } },
      },
      {
        message: 'entity s1: route item 3 points at c8, which is no crate',
        locator: { selection: 'entity:switch/s1', at: { x: 3, z: 3 } },
      },
    ])
  })

  it('passes an empty list and a list whose items all resolve', () => {
    const things = [
      at('crate', 'c1', 1, 1),
      at('switch', 's1', 3, 3, { route: [] }),
      at('switch', 's2', 4, 4, { route: [ref('c1'), ref('c1')] }),
    ]
    expect(check([crate, route], things)).toEqual([])
  })
})

describe('entityRefProblems: what `to` may name', () => {
  it('says a `to` that names no definition and is not `$sector`, once, without a place', () => {
    const def = switchWith({ id: 'opens', type: 'ref', to: ['crate', 'ghost', '$level'] })
    const things = [at('switch', 's1', 3, 3), at('switch', 's2', 4, 4)]
    expect(check([crate, def], things)).toEqual([
      { message: 'entity definition switch: opens may point at ghost, which is not a definition or $sector' },
      {
        message: 'entity definition switch: opens may point at $level, which is not a definition or $sector',
      },
    ])
  })

  it('takes every definition of the file, whatever its order, and a definition without things', () => {
    const def = switchWith({ id: 'opens', type: 'ref', to: ['lamp', 'crate'] })
    expect(check([def, crate, lamp], [])).toEqual([])
  })

  it('does not take a name for a definition when that definition could not be read', () => {
    const broken = { id: 'crate', shape: 'cylinder', fields: [] } as AfEntityDef
    expect(check([broken, opens], []).map((p) => p.message)).toEqual([
      'entity definition switch: opens may point at crate, which is not a definition or $sector',
    ])
  })
})

describe('entityRefProblems: what is the reader’s or the entity check’s to say', () => {
  it('does not say a ref to a thing the reader could not read: it is there, with its own problem', () => {
    const things = [
      at('crate', 'c1', 1, 1, { weight: { a: { b: 1 } } }),
      at('switch', 's1', 3, 3, { opens: ref('c1') }),
    ]
    expect(check([crate, opens], things)).toEqual([])
  })

  it('does not look at the refs of a thing the reader could not read', () => {
    const things = [at('switch', 's1', 3, 3, { opens: ref('c9'), tint: { a: { b: 1 } } })]
    expect(check([crate, opens], things)).toEqual([])
  })

  it('leaves a value that is not a ref, or a ref the reader refused, to the entity check', () => {
    const things = [
      at('switch', 's1', 3, 3, { opens: 5 }),
      at('switch', 's2', 4, 4, { opens: { target: '' } }),
      at('switch', 's3', 5, 5, { opens: { to: 'c1' } }),
    ]
    expect(check([crate, opens], things)).toEqual([])
  })

  it('does not read a value that is no ref field’s: a ref-shaped value of a text field is for the entity check', () => {
    const def = switchWith({ id: 'note', type: 'text' })
    expect(check([def], [at('switch', 's1', 3, 3, { note: ref('c9') })])).toEqual([])
  })

  it('does not read a single ref where the field is a list: that is for the entity check too', () => {
    const def = switchWith({ id: 'route', type: 'ref', list: true, to: ['crate'] })
    expect(check([crate, def], [at('switch', 's1', 3, 3, { route: ref('c9') })])).toEqual([])
  })

  it('says nothing for a level with no definitions and no things', () => {
    expect(check([], [])).toEqual([])
  })
})

describe('entityRefProblems: order', () => {
  it('says the definitions first, then each thing in file order, its fields in the definition’s order', () => {
    const def = switchWith(
      { id: 'b', type: 'ref', to: ['crate'] },
      { id: 'a', type: 'ref', to: ['crate', 'ghost'] },
    )
    const things = [
      at('switch', 's2', 4, 4, { a: ref('x'), b: ref('x') }),
      at('switch', 's1', 3, 3, { a: ref('y') }),
    ]
    expect(check([crate, def], things).map((p) => p.message)).toEqual([
      'entity definition switch: a may point at ghost, which is not a definition or $sector',
      'entity s2: b points at x, which is no crate',
      'entity s2: a points at x, which is no crate or ghost',
      'entity s1: a points at y, which is no crate or ghost',
    ])
  })
})
