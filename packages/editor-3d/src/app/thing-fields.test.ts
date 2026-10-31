// The field rows of a thing's card (ED3D.7d-b): ref rows carry what they may point at and what the value is called.
import { describe, expect, it } from 'vitest'
import type { ThingDef } from '../entities/thing-def.schema'
import type { Thing } from '../entities/things'
import { thingFieldRows } from './thing-fields'

const door: ThingDef = {
  id: 'door',
  shape: 'point',
  fields: [{ id: 'opens', type: 'ref', to: ['switch', '$sector'] }],
}
const lever: ThingDef = { id: 'switch', label: 'Switch', shape: 'point', fields: [] }
const thing = (def: string, id: string, values = {}): Thing => ({ def, id, x: 0, z: 0, values })
const level = (things: Thing[]) => ({
  definitions: [door, lever],
  things,
  sectorIds: ['hall', 'dock'],
})

describe('thingFieldRows', () => {
  const holder = thing('door', 'd1', { opens: { target: 's2' } })
  const things = [holder, thing('switch', 's1'), thing('switch', 's2')]

  it('offers the allowed things by definition, then the rooms, never the holder', () => {
    const [row] = thingFieldRows(holder, door, level(things))
    expect(row?.widget).toBe('ref')
    expect(
      row?.ref?.targets.map((group) => [group.id, group.name, group.choices.map((c) => c.label)]),
    ).toEqual([
      ['switch', 'Switch', ['s1', 's2']],
      ['$sector', 'Rooms', ['hall', 'dock']],
    ])
  })

  it('names the target, and has no name for one that points at nothing', () => {
    expect(thingFieldRows(holder, door, level(things))[0]?.ref?.name).toBe('s2')
    const broken = thing('door', 'd1', { opens: { target: 'gone' } })
    expect(thingFieldRows(broken, door, level([broken]))[0]?.ref?.name).toBeUndefined()
  })
})
