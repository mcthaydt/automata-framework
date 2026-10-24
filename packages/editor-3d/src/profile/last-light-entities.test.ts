// Last Light's fixed things in the shared entity model (ED3D.1b2 step 3): the definitions, and the arrays read as things.
import { checkValues } from '@mcthaydt/automata-editor-kit/fields'
import { describe, expect, it } from 'vitest'
import { lastLightChecks } from '../checks/last-light/last-light-checks'
import { thingDefSchema } from '../entities/thing-def.schema'
import type { Blockout } from '../format/blockout.schema'
import { parseSelection } from '../model/selection-ref'
import { caseDocument, loadCheckCases, loadChecksGolden } from '../testing/check-cases'
import { FIXTURE_NAMES, loadFixture } from '../testing/fixtures'
import { must, toyBlockout } from '../testing/toy-blockout'
import { blockoutCodec } from './last-light-codecs'
import { lastLightDefinitions, lastLightEntityKit } from './last-light-entities'

const BLOCKOUTS = FIXTURE_NAMES.filter((name) => name !== 'facility')

function read(name: (typeof FIXTURE_NAMES)[number]): Blockout {
  const result = blockoutCodec.parse(loadFixture(name))
  if (!result.ok) throw new Error(`${name} does not parse`)
  return result.value
}

const definition = (id: string) => must(lastLightDefinitions.find((def) => def.id === id))

describe('lastLightDefinitions', () => {
  it('are the spawn, the box, the hotspot, the lamp, the anchor and the nav node', () => {
    expect(lastLightDefinitions.map((def) => [def.id, def.shape])).toEqual([
      ['spawn', 'point'],
      ['box', 'box'],
      ['hotspot', 'point'],
      ['lamp', 'point'],
      ['anchor', 'point'],
      ['node', 'point'],
    ])
  })

  it('pass the rules an author’s definitions pass, unchanged', () => {
    for (const def of lastLightDefinitions) {
      const parsed = thingDefSchema.safeParse(def)
      expect(parsed.success, def.id).toBe(true)
      expect(parsed.data).toEqual(def)
    }
  })

  it('have one spawn, and every thing float at the y its file gives it', () => {
    expect(lastLightDefinitions.filter((def) => def.single).map((def) => def.id)).toEqual(['spawn'])
    expect(lastLightDefinitions.every((def) => def.sit === 'free')).toBe(true)
  })

  it('size a box by the w, h and d of each box, above a centimetre', () => {
    const box = definition('box')
    expect(box.size).toBeUndefined()
    expect(
      box.fields
        .filter((field) => 'whd'.includes(field.id))
        .map((field) => [field.id, field.type, field.min]),
    ).toEqual([
      ['w', 'float', 0.01],
      ['h', 'float', 0.01],
      ['d', 'float', 0.01],
    ])
  })

  it('say for every field its type, whether a file must have it and its bounds', () => {
    const summary = (field: (typeof lastLightDefinitions)[number]['fields'][number]): string =>
      `${field.id}:${field.type}${field.list ? '[]' : ''}${field.required ? '!' : ''}${
        field.min === undefined ? '' : ` >=${field.min}`
      }${field.max === undefined ? '' : ` <=${field.max}`}`
    expect(Object.fromEntries(lastLightDefinitions.map((def) => [def.id, def.fields.map(summary)]))).toEqual({
      spawn: ['facing:angle!'],
      box: ['w:float! >=0.01', 'h:float! >=0.01', 'd:float! >=0.01', 'kind:enum!', 'role:enum!'],
      hotspot: ['name:text!', 'reach:float! >=0', 'hide:bool', 'on:text'],
      lamp: ['range:float! >=0', 'radius:float! >=0', 'color:float[]! >=0 <=1', 'kind:text', 'on:text'],
      anchor: ['radius:float >=0', 'on:text'],
      node: ['on:text'],
    })
  })

  it('give the box kinds and roles the schema has', () => {
    const options = (id: string) => definition('box').fields.find((field) => field.id === id)?.options
    expect(options('kind')).toEqual(['desk', 'bench', 'bed', 'exit', 'door', 'furniture'])
    expect(options('role')).toEqual(['collider', 'seat', 'door'])
  })

  it('hold a lamp’s colour as the three floats the file has', () => {
    const color = definition('lamp').fields.find((field) => field.id === 'color')
    expect(color).toMatchObject({ type: 'float', list: true, min: 0, max: 1, required: true })
  })
})

describe('the definition ids and the Last Light checks', () => {
  it('are the ones every locator of the seeded violations names, so Locate selects the thing the check meant', () => {
    const known = new Set(lastLightDefinitions.map((def) => def.id))
    const golden = loadChecksGolden()
    const named = new Set<string>()
    for (const spec of loadCheckCases()) {
      const results = lastLightChecks(caseDocument(spec), { puzzleHotspots: golden.cases[spec.id]?.puzzle })
      for (const { problems } of results)
        for (const problem of problems)
          for (const locator of [problem.locator, ...(problem.related ?? [])]) {
            const ref = locator === undefined ? undefined : parseSelection(locator.selection)
            if (ref?.kind === 'entity') named.add(ref.definition)
          }
    }
    // Zones are not things yet (ED3D.7), so their locators name a definition that is not there.
    expect([...named].filter((id) => id !== 'zone' && !known.has(id))).toEqual([])
    // The corpus reaches the kinds that a nav check, a door check and an ids check locate.
    expect([...named].sort()).toEqual(
      expect.arrayContaining(['anchor', 'box', 'hotspot', 'lamp', 'node', 'spawn']),
    )
  })
})

describe('lastLightEntityKit', () => {
  it.each(BLOCKOUTS)(
    '%s: every array is things, none is a problem, and every value fits its field',
    (name) => {
      const blockout = read(name)
      const kit = lastLightEntityKit(blockout)
      expect(kit.problems).toEqual([])
      expect(kit.definitions).toEqual(lastLightDefinitions)
      const count = (id: string) => kit.things.filter((thing) => thing.def === id).length
      expect(count('spawn')).toBe(1)
      expect(count('box')).toBe(blockout.boxes.length)
      expect(count('hotspot')).toBe(blockout.hotspots.length)
      expect(count('lamp')).toBe(blockout.lamps.length)
      expect(count('anchor')).toBe(Object.keys(blockout.anchors ?? {}).length)
      expect(count('node')).toBe(Object.keys(blockout.nav.nodes ?? {}).length)
      expect(kit.things).toHaveLength(
        1 +
          blockout.boxes.length +
          blockout.hotspots.length +
          blockout.lamps.length +
          Object.keys(blockout.anchors ?? {}).length +
          Object.keys(blockout.nav.nodes ?? {}).length,
      )
      for (const thing of kit.things)
        expect(checkValues(definition(thing.def).fields, thing.values), `${thing.def} ${thing.id}`).toEqual(
          [],
        )
    },
  )

  it('gives the spawn first, then boxes, hotspots, lamps, anchors and nav nodes, each in the order of its array', () => {
    const blockout = read('blockout-clinic-dawn')
    const kit = lastLightEntityKit(blockout)
    const order = [...new Set(kit.things.map((thing) => thing.def))]
    expect(order).toEqual(['spawn', 'box', 'hotspot', 'lamp', 'anchor', 'node'])
    const ids = (id: string) => kit.things.filter((thing) => thing.def === id).map((thing) => thing.id)
    expect(ids('box')).toEqual(blockout.boxes.map((box) => box.id))
    expect(ids('hotspot')).toEqual(blockout.hotspots.map((hotspot) => hotspot.id))
    expect(ids('lamp')).toEqual(blockout.lamps.map((lamp) => lamp.id))
    expect(ids('anchor')).toEqual(Object.keys(blockout.anchors ?? {}))
    expect(ids('node')).toEqual(Object.keys(blockout.nav.nodes ?? {}))
  })

  it('takes the place and the values of a box, a hotspot and a lamp as the file has them', () => {
    const blockout = read('blockout-clinic-dawn')
    const kit = lastLightEntityKit(blockout)
    const thing = (def: string, id: string) =>
      must(kit.things.find((candidate) => candidate.def === def && candidate.id === id))
    expect(thing('box', 'closetDoor')).toEqual({
      def: 'box',
      id: 'closetDoor',
      x: 1.6,
      z: -4,
      y: 1.05,
      values: { w: 0.12, h: 2.1, d: 1, kind: 'door', role: 'door' },
    })
    expect(thing('hotspot', 'bed')).toEqual({
      def: 'hotspot',
      id: 'bed',
      x: -4.1,
      z: 0.6,
      y: 0.9,
      values: { name: 'Bed 04', reach: 1.6, on: 'box:bed' },
    })
    expect(thing('lamp', 'deskLamp')).toEqual({
      def: 'lamp',
      id: 'deskLamp',
      x: 3.05,
      z: 1.15,
      y: 1.55,
      values: { kind: 'desk', range: 5, radius: 1.7, color: [1, 0.72, 0.4] },
    })
  })

  it('names the spawn spawn, as the spec does, and keeps its facing', () => {
    const blockout = read('blockout-clinic-dawn')
    const spawn = must(lastLightEntityKit(blockout).things.find((thing) => thing.def === 'spawn'))
    expect(spawn).toEqual({
      def: 'spawn',
      id: 'spawn',
      x: blockout.spawn.x,
      z: blockout.spawn.z,
      y: blockout.spawn.y,
      values: { facing: blockout.spawn.facing },
    })
  })

  it('names an anchor and a nav node by the key of its record, and gives neither a y it does not have', () => {
    const blockout = read('blockout-clinic-dawn')
    const kit = lastLightEntityKit(blockout)
    const leak = must(kit.things.find((thing) => thing.def === 'anchor' && thing.id === 'leak'))
    expect(leak).toEqual({ def: 'anchor', id: 'leak', x: -1.05, z: -4.1, values: { radius: 0.72 } })
    expect('y' in leak).toBe(false)
    const end = must(kit.things.find((thing) => thing.def === 'node' && thing.id === 'end'))
    expect(end).toEqual({ def: 'node', id: 'end', x: 0, z: -6.1, values: {} })
  })

  it('is a spawn, a box and a hotspot for the toy, and no anchor or nav node it does not have', () => {
    const kit = lastLightEntityKit(toyBlockout())
    expect(kit.problems).toEqual([])
    expect(kit.things.map((thing) => `${thing.def}/${thing.id}`)).toEqual([
      'spawn/spawn',
      'box/abDoor',
      'hotspot/far',
    ])
  })

  it('lets a member the fixed definitions do not know into the values, without a problem', () => {
    const toy = toyBlockout()
    const box = must(toy.boxes[0])
    const kit = lastLightEntityKit({ ...toy, boxes: [{ ...box, tint: 'red' } as typeof box] })
    expect(kit.problems).toEqual([])
    expect(must(kit.things.find((thing) => thing.def === 'box')).values).toMatchObject({ tint: 'red' })
  })

  it('says, at the member in the model, when a value is not one a field can hold', () => {
    const toy = toyBlockout()
    const kit = lastLightEntityKit({
      ...toy,
      anchors: { fuse: { x: 1, z: 2, odd: { a: { b: 1 } } } as unknown as { x: number; z: number } },
    })
    expect(kit.things.some((thing) => thing.def === 'anchor')).toBe(false)
    expect(kit.problems).toEqual([
      {
        path: ['anchors', 'fuse', 'odd'],
        message: 'entity fuse: odd is not a value a field can hold',
        entity: { def: 'anchor', id: 'fuse', at: { x: 1, z: 2 } },
      },
    ])
  })

  it('names a thing by the key of its record even when the record has an id of its own', () => {
    const toy = toyBlockout()
    const kit = lastLightEntityKit({
      ...toy,
      anchors: { fuse: { id: 'other', x: 1, z: 2 } as unknown as { x: number; z: number } },
    })
    const fuse = must(kit.things.find((thing) => thing.def === 'anchor'))
    expect(fuse.id).toBe('fuse')
    expect(fuse.values).toEqual({})
  })

  it('says where in the model a value is wrong, for a list, a record and the nav nodes', () => {
    const toy = toyBlockout()
    const odd = { odd: { a: { b: 1 } } }
    const kit = lastLightEntityKit({
      ...toy,
      boxes: [{ ...must(toy.boxes[0]), ...odd }],
      nav: { nodes: { end: { x: 0, z: 1, ...odd } as unknown as { x: number; z: number } } },
    })
    expect(kit.problems.map((problem) => problem.path)).toEqual([
      ['boxes', 0, 'odd'],
      ['nav', 'nodes', 'end', 'odd'],
    ])
  })

  it('does not change the blockout it reads', () => {
    const blockout = read('blockout-clinic-dawn')
    const before = JSON.stringify(blockout)
    lastLightEntityKit(blockout)
    expect(JSON.stringify(blockout)).toBe(before)
  })
})
