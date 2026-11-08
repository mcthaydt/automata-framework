// How things are written into an `af-sector/1` level (ED3D.7a step 1): the access puts a thing where the file keeps it
// and the codec turns that into the smallest patch, so a thing that is moved changes its `x` and `z` and nothing else.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { afEntityKit } from '#src/shared/level-session/af-sector/af-entities.ts'
import { afThingAccess } from '#src/shared/level-session/af-sector/af-things.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { ThingAccessError } from '#src/shared/level-session/thing-access.ts'
import type { Thing } from '#src/shared/things/things.ts'
import { must } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { changedRegion, literalEdits } from '#src/testing/text-diff.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

const depotText = loadAuthored('depot.af-sector')
const depot = ((): AfSector => {
  const result = afSectorProfile.parse(depotText)
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const thingOf = (level: AfSector, id: string): Thing =>
  must(afEntityKit(level).things.find((thing) => thing.id === id))

const patched = (before: AfSector, after: AfSector, text = depotText): string => {
  const result = afSectorProfile.patch(text, before, after)
  if (!result.ok) throw new Error(`patch refused at ${JSON.stringify(result.path)}: ${result.detail}`)
  return result.text
}

const crate = (id: string, more: Partial<Thing> = {}): Thing => ({
  def: 'crate',
  id,
  x: 5,
  z: 3,
  values: { contents: 'tools' },
  ...more,
})

describe('afThingAccess.add', () => {
  it('appends the thing to the file’s entities as { def, id, x, z, ...fields }, and the patch inserts that one element', () => {
    const next = afThingAccess.add(depot, crate('crate2'))
    expect(next.entities?.at(-1)).toEqual({ def: 'crate', id: 'crate2', x: 5, z: 3, contents: 'tools' })
    expect(Object.keys(next.entities?.at(-1) ?? {})).toEqual(['def', 'id', 'x', 'z', 'contents'])
    expect(next.entities).toHaveLength((depot.entities ?? []).length + 1)
    expect(next.entities?.slice(0, -1)).toEqual(depot.entities)
    const text = patched(depot, next)
    const { removed, added } = changedRegion(depotText, text)
    expect(removed).toBe('')
    expect(added).toContain('"crate2"')
    expect(afSectorProfile.parse(text)).toEqual({ ok: true, value: next })
  })

  it('writes a height between x and z, and the file’s first entity list when it has none', () => {
    const lonely = toyAfSector()
    const next = afThingAccess.add(lonely, crate('c', { y: 0.5 }))
    expect(next.entities).toEqual([{ def: 'crate', id: 'c', x: 5, y: 0.5, z: 3, contents: 'tools' }])
    expect(Object.keys(next.entities?.[0] ?? {})).toEqual(['def', 'id', 'x', 'y', 'z', 'contents'])
    expect(lonely.entities).toBeUndefined()
  })

  it('leaves everything else of the level as the same objects', () => {
    const next = afThingAccess.add(depot, crate('crate2'))
    expect(next.sectors).toBe(depot.sectors)
    expect(next.entityDefs).toBe(depot.entityDefs)
    expect(next.entities?.[0]).toBe(depot.entities?.[0])
  })
})

describe('afThingAccess.replace', () => {
  it('is the level itself for a thing as it was read, whichever thing', () => {
    for (const thing of afEntityKit(depot).things)
      expect(afThingAccess.replace(depot, thing.def, thing.id, thing)).toBe(depot)
  })

  it('moves a thing in its own place in the list, and the patch changes its x and z and no other byte', () => {
    const moved = { ...thingOf(depot, 'crate1'), x: 12.5, z: 3 }
    const next = afThingAccess.replace(depot, 'crate', 'crate1', moved)
    expect(next.entities?.map((entity) => entity.id)).toEqual(depot.entities?.map((entity) => entity.id))
    expect(next.entities?.[1]).toEqual({ def: 'crate', id: 'crate1', x: 12.5, z: 3, contents: 'tools' })
    expect(next.entities?.[0]).toBe(depot.entities?.[0])
    const text = patched(depot, next)
    expect(literalEdits(depotText, text)).toEqual(['["entities",1,"x"]', '["entities",1,"z"]'])
    expect(patched(next, depot, text)).toBe(depotText)
  })

  it('keeps the members in the order the file has them, and changes a field in place', () => {
    const shuffled: AfSector = {
      ...depot,
      entities: [
        { contents: 'tools', z: 2, x: 11, id: 'crate1', def: 'crate' },
        ...(depot.entities ?? []).slice(0, 1),
      ],
    }
    const thing = thingOf(shuffled, 'crate1')
    const next = afThingAccess.replace(shuffled, 'crate', 'crate1', {
      ...thing,
      x: 9,
      values: { contents: 'empty' },
    })
    expect(Object.keys(next.entities?.[0] ?? {})).toEqual(['contents', 'z', 'x', 'id', 'def'])
    expect(next.entities?.[0]).toMatchObject({ contents: 'empty', x: 9, z: 2 })
  })

  it('drops a member the thing no longer has, and adds a height after the members it follows', () => {
    const next = afThingAccess.replace(depot, 'crate', 'crate1', { ...thingOf(depot, 'crate1'), values: {} })
    expect(next.entities?.[1]).toEqual({ def: 'crate', id: 'crate1', x: 11, z: 2 })
    const lifted = afThingAccess.replace(depot, 'crate', 'crate1', { ...thingOf(depot, 'crate1'), y: 0.25 })
    expect(Object.keys(lifted.entities?.[1] ?? {})).toEqual(['def', 'id', 'x', 'z', 'contents', 'y'])
    const dropped = afThingAccess.replace(lifted, 'crate', 'crate1', thingOf(depot, 'crate1'))
    expect(dropped.entities?.[1]).toEqual(depot.entities?.[1])
  })

  it('refuses a thing the level does not have, and finds it by definition as well as id', () => {
    expect(() => afThingAccess.replace(depot, 'crate', 'ghost', crate('ghost'))).toThrow(ThingAccessError)
    expect(() => afThingAccess.replace(depot, 'spawn', 'crate1', crate('crate1'))).toThrow('no spawn crate1')
  })
})

describe('afThingAccess.remove', () => {
  it('takes the element out and leaves the others as the same objects, and the patch removes that element', () => {
    const next = afThingAccess.remove(depot, 'crate', 'crate1')
    expect(next.entities).toEqual([depot.entities?.[0]])
    expect(next.entities?.[0]).toBe(depot.entities?.[0])
    const text = patched(depot, next)
    expect(afSectorProfile.parse(text)).toEqual({ ok: true, value: next })
    expect(text).not.toContain('crate1')
  })

  it('refuses a thing the level does not have', () => {
    expect(() => afThingAccess.remove(depot, 'crate', 'ghost')).toThrow('no crate ghost')
    expect(() => afThingAccess.remove(toyAfSector(), 'crate', 'c')).toThrow(ThingAccessError)
  })
})

describe('afThingAccess.takenIds', () => {
  it('is every entity’s id, whatever its definition, because ids are unique across the file', () => {
    expect(afThingAccess.takenIds(depot, 'crate')).toEqual(['spawn', 'crate1'])
    expect(afThingAccess.takenIds(depot, 'lamp')).toEqual(['spawn', 'crate1'])
    expect(afThingAccess.takenIds(toyAfSector(), 'crate')).toEqual([])
  })
})

describe('afThingAccess.references', () => {
  const holder: AfSector = {
    ...depot,
    entityDefs: [
      ...(depot.entityDefs ?? []),
      {
        id: 'switch',
        shape: 'point',
        fields: [
          { id: 'opens', type: 'ref' },
          { id: 'also', type: 'ref', list: true },
          { id: 'label', type: 'text' },
        ],
      },
    ],
    entities: [
      ...(depot.entities ?? []),
      {
        def: 'switch',
        id: 'sw1',
        x: 2,
        z: 2,
        opens: { target: 'crate1' },
        also: [{ target: 'spawn' }, { target: 'crate1' }],
      },
      { def: 'switch', id: 'sw2', x: 3, z: 2, opens: { target: 'hall' }, label: 'crate1' },
    ],
  }

  it('names each ref field of another thing that points at the id, a list field by the item', () => {
    expect(afThingAccess.references(holder, 'crate', 'crate1')).toEqual([
      'entity sw1: opens points at crate1',
      'entity sw1: also item 1 points at crate1',
    ])
    expect(afThingAccess.references(holder, 'spawn', 'spawn')).toEqual([
      'entity sw1: also item 0 points at spawn',
    ])
  })

  it('has nothing to say for a thing nothing points at, for a sector name or for a text that happens to match', () => {
    expect(afThingAccess.references(holder, 'switch', 'sw2')).toEqual([])
    expect(afThingAccess.references(depot, 'crate', 'crate1')).toEqual([])
  })

  it('does not count a thing’s own ref to itself', () => {
    const selfish: AfSector = {
      ...holder,
      entities: [
        ...(holder.entities ?? []),
        { def: 'switch', id: 'sw3', x: 4, z: 2, opens: { target: 'sw3' } },
      ],
    }
    expect(afThingAccess.references(selfish, 'switch', 'sw3')).toEqual([])
  })
})

describe('the af-sector profile', () => {
  it('writes things through afThingAccess', () => {
    expect(afSectorProfile.things).toBe(afThingAccess)
  })
})
