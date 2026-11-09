// What a thing's ref fields point at (ED3D.7a step 1): the reading the ref check and the removal of a thing share.
import type { FieldDef } from '@automata/editor/kit/fields'
import { describe, expect, it } from 'vitest'
import { refsOf, targetOf } from './thing-refs'
import type { Thing } from './things'

// A file may hold anything under a member, so the values here are not always field values.
const thing = (values: Record<string, unknown>): Thing => ({
  def: 'switch',
  id: 's',
  x: 0,
  z: 0,
  values: values as Thing['values'],
})

const FIELDS: readonly FieldDef[] = [
  { id: 'opens', type: 'ref', to: ['crate', '$sector'] },
  { id: 'also', type: 'ref', list: true },
  { id: 'label', type: 'text' },
]

describe('targetOf', () => {
  it('is the target of a ref value and nothing for any other value', () => {
    expect(targetOf({ target: 'crate1' })).toBe('crate1')
    expect(targetOf({ target: 'crate1', container: 'elsewhere' })).toBe('crate1')
    for (const value of [undefined, null, 'crate1', 4, [], {}, { target: 5 }, { target: null }])
      expect(targetOf(value), JSON.stringify(value)).toBeUndefined()
  })
})

describe('refsOf', () => {
  it('lists each ref of the fields in definition order, an item of a list field by its index, with what the field allows', () => {
    const refs = refsOf(
      thing({ also: [{ target: 'a' }, { target: 'b' }], opens: { target: 'crate1' }, label: 'crate1' }),
      FIELDS,
    )
    expect(refs).toEqual([
      { field: 'opens', which: 'opens', target: 'crate1', to: ['crate', '$sector'] },
      { field: 'also', which: 'also item 0', target: 'a', to: [] },
      { field: 'also', which: 'also item 1', target: 'b', to: [] },
    ])
  })

  it('skips what is no ref: a text that matches, a ref with no target, a list field that is no list', () => {
    expect(refsOf(thing({ label: 'x', opens: {}, also: { target: 'a' } }), FIELDS)).toEqual([])
    expect(refsOf(thing({ also: [{ target: 'a' }, {}, 'b', { target: 'c' }] }), FIELDS)).toEqual([
      { field: 'also', which: 'also item 0', target: 'a', to: [] },
      { field: 'also', which: 'also item 3', target: 'c', to: [] },
    ])
    expect(refsOf(thing({}), FIELDS)).toEqual([])
  })
})
