// How things are written into a Last Light blockout (ED3D.7a step 2): the access puts a thing where the file keeps it (a
// list element with an `id`, a record entry under its key, the spawn object) and the codec turns that into the smallest
// patch, so a box that is moved changes its `x` and `z` and nothing else. The references are what the game's `ids`
// check would later call dangling: an `on`, an opening's door, a nav edge, the patrol.
import { describe, expect, it } from 'vitest'
import type { Thing } from '../entities/things'
import type { Blockout } from '../format/blockout.schema'
import { FIXTURE_NAMES, loadFixture } from '../testing/fixtures'
import { changedRegion, literalEdits } from '../testing/text-diff'
import { must, toyBlockout } from '../testing/toy-blockout'
import { blockoutCodec } from './last-light-codecs'
import { lastLightEntityKit } from './last-light-entities'
import { lastLightProfile } from './last-light-profile'
import { lastLightThingAccess as access } from './last-light-things'
import { ThingAccessError } from './thing-access'

const BLOCKOUTS = FIXTURE_NAMES.filter((name) => name !== 'facility')

function read(name: (typeof FIXTURE_NAMES)[number]): { text: string; level: Blockout } {
  const text = loadFixture(name)
  const result = blockoutCodec.parse(text)
  if (!result.ok) throw new Error(`${name} does not parse`)
  return { text, level: result.value }
}

const patched = (text: string, before: Blockout, after: Blockout): string => {
  const result = blockoutCodec.patch(text, before, after)
  if (!result.ok) throw new Error(`patch refused at ${JSON.stringify(result.path)}: ${result.detail}`)
  return result.text
}

const thingOf = (level: Blockout, def: string, id: string): Thing =>
  must(lastLightEntityKit(level).things.find((thing) => thing.def === def && thing.id === id))

const dawn = read('blockout-clinic-dawn')
const bay = read('blockout-bay')

describe('lastLightThingAccess.add', () => {
  it('appends a box to the boxes as { id, x, y, z, ...fields }, with no def', () => {
    const toy = toyBlockout()
    const next = access.add(toy, {
      def: 'box',
      id: 'crate',
      x: 2,
      y: 0.5,
      z: 3,
      values: { w: 1, h: 1, d: 1, kind: 'furniture', role: 'collider' },
    })
    expect(next.boxes.at(-1)).toEqual({
      id: 'crate',
      x: 2,
      y: 0.5,
      z: 3,
      w: 1,
      h: 1,
      d: 1,
      kind: 'furniture',
      role: 'collider',
    })
    expect(Object.keys(next.boxes.at(-1) ?? {})).toEqual(['id', 'x', 'y', 'z', 'w', 'h', 'd', 'kind', 'role'])
    expect(next.boxes).toHaveLength(2)
    expect(next.boxes[0]).toBe(toy.boxes[0])
  })

  it('appends a hotspot and a lamp to their lists, and the other lists stay the very same arrays', () => {
    const toy = toyBlockout()
    const withHotspot = access.add(toy, {
      def: 'hotspot',
      id: 'sign',
      x: 1,
      y: 1,
      z: 2,
      values: { name: 'Sign', reach: 1.2 },
    })
    expect(withHotspot.hotspots.map((each) => each.id)).toEqual(['far', 'sign'])
    expect(withHotspot.boxes).toBe(toy.boxes)
    const withLamp = access.add(toy, {
      def: 'lamp',
      id: 'bulb',
      x: 1,
      y: 2.5,
      z: 2,
      values: { range: 4, radius: 1, color: [1, 0.9, 0.7] },
    })
    expect(withLamp.lamps).toEqual([
      { id: 'bulb', x: 1, y: 2.5, z: 2, range: 4, radius: 1, color: [1, 0.9, 0.7] },
    ])
  })

  it('writes an anchor under its key with no id and no def, and makes the record when the level has none', () => {
    const toy = toyBlockout()
    expect(toy.anchors).toBeUndefined()
    const next = access.add(toy, { def: 'anchor', id: 'leak', x: 1, z: 2, values: { radius: 0.5 } })
    expect(next.anchors).toEqual({ leak: { x: 1, z: 2, radius: 0.5 } })
    const more = access.add(next, { def: 'anchor', id: 'drip', x: 3, y: 1, z: 2, values: {} })
    expect(Object.keys(more.anchors ?? {})).toEqual(['leak', 'drip'])
    expect(more.anchors?.drip).toEqual({ x: 3, y: 1, z: 2 })
    expect(more.anchors?.leak).toBe(next.anchors?.leak)
  })

  it('writes a nav node under nav.nodes and keeps the rest of the nav as it was', () => {
    const toy = toyBlockout({ nav: { patrol: ['n1'] } })
    const next = access.add(toy, { def: 'node', id: 'n1', x: 1, z: 1, values: {} })
    expect(next.nav).toEqual({ patrol: ['n1'], nodes: { n1: { x: 1, z: 1 } } })
    const more = access.add(next, { def: 'node', id: 'n2', x: 2, z: 1, values: { on: 'box:abDoor' } })
    expect(Object.keys(more.nav.nodes ?? {})).toEqual(['n1', 'n2'])
    expect(more.nav.nodes?.n2).toEqual({ x: 2, z: 1, on: 'box:abDoor' })
  })

  it('cannot add a second spawn, or a definition the format does not have', () => {
    const spawn: Thing = { def: 'spawn', id: 'spawn', x: 0, z: 0, y: 0, values: { facing: 0 } }
    expect(() => access.add(toyBlockout(), spawn)).toThrow('a spawn already, and only one')
    expect(() => access.add(toyBlockout(), { ...spawn, def: 'crate', id: 'c' })).toThrow(
      'no place for a crate',
    )
  })

  it('patches in the one element it adds', () => {
    const before = dawn.level
    const after = access.add(before, {
      def: 'hotspot',
      id: 'plaque',
      x: 1,
      y: 1,
      z: 1,
      values: { name: 'Plaque', reach: 1 },
    })
    const text = patched(dawn.text, before, after)
    const { removed, added } = changedRegion(dawn.text, text)
    expect(removed).toBe('')
    expect(added).toContain('"plaque"')
    expect(blockoutCodec.parse(text)).toEqual({ ok: true, value: after })
  })
})

describe('lastLightThingAccess.replace', () => {
  it.each(BLOCKOUTS)('%s: is the level itself for every thing as it was read', (name) => {
    const { level } = read(name)
    const { things } = lastLightEntityKit(level)
    expect(things.length).toBeGreaterThan(40)
    for (const thing of things) expect(access.replace(level, thing.def, thing.id, thing)).toBe(level)
  })

  it('moves a box in its own place in the list, and the patch changes its x and z and no other byte', () => {
    const before = bay.level
    const at = before.boxes.findIndex((box) => box.id === 'ambulance')
    const moved = { ...thingOf(before, 'box', 'ambulance'), x: 1.25, z: -3.5 }
    const after = access.replace(before, 'box', 'ambulance', moved)
    expect(after.boxes.map((box) => box.id)).toEqual(before.boxes.map((box) => box.id))
    expect(after.boxes[at]).toMatchObject({ id: 'ambulance', x: 1.25, z: -3.5 })
    expect(after.boxes[at === 0 ? 1 : 0]).toBe(before.boxes[at === 0 ? 1 : 0])
    const text = patched(bay.text, before, after)
    expect(literalEdits(bay.text, text)).toEqual([`["boxes",${at},"x"]`, `["boxes",${at},"z"]`])
    expect(patched(text, after, before)).toBe(bay.text)
  })

  it('moves an anchor and a node under their keys, and the spawn in its own object', () => {
    const before = bay.level
    const anchor = access.replace(before, 'anchor', 'drum', { ...thingOf(before, 'anchor', 'drum'), x: -1 })
    expect(literalEdits(bay.text, patched(bay.text, before, anchor))).toEqual(['["anchors","drum","x"]'])
    const node = access.replace(before, 'node', 'bayE', { ...thingOf(before, 'node', 'bayE'), z: -2 })
    expect(literalEdits(bay.text, patched(bay.text, before, node))).toEqual(['["nav","nodes","bayE","z"]'])
    const spawn = access.replace(before, 'spawn', 'spawn', { ...thingOf(before, 'spawn', 'spawn'), x: 9 })
    expect(literalEdits(bay.text, patched(bay.text, before, spawn))).toEqual(['["spawn","x"]'])
    expect(spawn.boxes).toBe(before.boxes)
  })

  it('changes a field in place, drops a member the thing no longer has and adds one it newly has', () => {
    const before = dawn.level
    const hotspot = thingOf(before, 'hotspot', 'bed')
    const renamed = access.replace(before, 'hotspot', 'bed', {
      ...hotspot,
      values: { ...hotspot.values, name: 'Bed 05' },
    })
    expect(literalEdits(dawn.text, patched(dawn.text, before, renamed))).toEqual([
      `["hotspots",${before.hotspots.findIndex((each) => each.id === 'bed')},"name"]`,
    ])
    const { on, ...without } = hotspot.values
    expect(on).toBe('box:bed')
    const detached = access.replace(before, 'hotspot', 'bed', { ...hotspot, values: without })
    expect(detached.hotspots.find((each) => each.id === 'bed')).not.toHaveProperty('on')
    const hidden = access.replace(before, 'hotspot', 'bed', {
      ...hotspot,
      values: { ...hotspot.values, hide: true },
    })
    expect(Object.keys(hidden.hotspots.find((each) => each.id === 'bed') ?? {}).at(-1)).toBe('hide')
  })

  it('refuses a thing the level does not have, by id and by definition', () => {
    const toy = toyBlockout()
    expect(() => access.replace(toy, 'box', 'ghost', thingOf(toy, 'box', 'abDoor'))).toThrow('no box ghost')
    expect(() => access.replace(toy, 'hotspot', 'abDoor', thingOf(toy, 'box', 'abDoor'))).toThrow(
      ThingAccessError,
    )
    expect(() => access.replace(toy, 'anchor', 'a', thingOf(toy, 'box', 'abDoor'))).toThrow('no anchor a')
    expect(() => access.replace(toy, 'node', 'toString', thingOf(toy, 'box', 'abDoor'))).toThrow(
      'no node toString',
    )
    expect(() => access.replace(toy, 'spawn', 'second', thingOf(toy, 'spawn', 'spawn'))).toThrow(
      'no spawn second',
    )
  })
})

describe('lastLightThingAccess.remove', () => {
  it('takes a box out of its list and leaves the other elements as the same objects, and the patch removes it', () => {
    const before = dawn.level
    const after = access.remove(before, 'box', 'bin')
    expect(after.boxes).toHaveLength(before.boxes.length - 1)
    expect(after.boxes.some((box) => box.id === 'bin')).toBe(false)
    expect(after.boxes[0]).toBe(before.boxes[0])
    const text = patched(dawn.text, before, after)
    expect(blockoutCodec.parse(text)).toEqual({ ok: true, value: after })
    expect(changedRegion(dawn.text, text).added).toBe('')
  })

  it('takes an anchor or a node out of its record, and an emptied record stays an empty record', () => {
    const toy = toyBlockout({
      anchors: { only: { x: 1, z: 1 } },
      nav: { nodes: { solo: { x: 2, z: 2 } } },
    })
    expect(access.remove(toy, 'anchor', 'only').anchors).toEqual({})
    expect(access.remove(toy, 'node', 'solo').nav).toEqual({ nodes: {} })
    const many = access.remove(bay.level, 'anchor', 'burner')
    expect(Object.keys(many.anchors ?? {})).toEqual(['drum', 'mortuaryLine', 'latchBang'])
    expect(many.anchors?.drum).toBe(bay.level.anchors?.drum)
  })

  it('cannot take away the spawn, and refuses a thing the level does not have', () => {
    expect(() => access.remove(toyBlockout(), 'spawn', 'spawn')).toThrow('cannot do without its spawn')
    expect(() => access.remove(toyBlockout(), 'box', 'ghost')).toThrow('no box ghost')
    expect(() => access.remove(toyBlockout(), 'anchor', 'ghost')).toThrow('no anchor ghost')
    expect(() => access.remove(toyBlockout(), 'node', 'constructor')).toThrow('no node constructor')
  })
})

describe('lastLightThingAccess.takenIds', () => {
  it('are the ids of that definition only, so an anchor and a lamp may share one', () => {
    const level = toyBlockout({
      lamps: [{ id: 'leak', x: 1, y: 2, z: 1, range: 3, radius: 1, color: [1, 1, 1] }],
      anchors: { leak: { x: 1, z: 1 } },
      nav: { nodes: { hub: { x: 1, z: 2 } } },
    })
    expect(access.takenIds(level, 'lamp')).toEqual(['leak'])
    expect(access.takenIds(level, 'anchor')).toEqual(['leak'])
    expect(access.takenIds(level, 'node')).toEqual(['hub'])
    expect(access.takenIds(level, 'box')).toEqual(['abDoor'])
    expect(access.takenIds(level, 'hotspot')).toEqual(['far'])
    expect(access.takenIds(level, 'spawn')).toEqual(['spawn'])
    expect(access.takenIds(level, 'crate')).toEqual([])
    expect(access.takenIds(level, 'constructor')).toEqual([])
    expect(access.takenIds(toyBlockout(), 'anchor')).toEqual([])
    expect(access.takenIds(toyBlockout(), 'node')).toEqual([])
  })
})

describe('lastLightThingAccess.references', () => {
  const level = toyBlockout({
    hotspots: [
      { id: 'far', x: 6, y: 1, z: 3, name: 'Far wall', reach: 1.4 },
      { id: 'knob', x: 4, y: 1, z: 2, name: 'Knob', reach: 1, on: 'box:abDoor' },
      { id: 'sill', x: 1, y: 1, z: 0, name: 'Sill', reach: 1, on: 'wall:a/0' },
    ],
    lamps: [{ id: 'spot', x: 4, y: 2, z: 2, range: 3, radius: 1, color: [1, 1, 1], on: 'box:abDoor' }],
    anchors: { latch: { x: 4, z: 2, on: 'box:abDoor' }, sillMark: { x: 1, z: 0, on: 'wall:a/0' } },
    nav: {
      nodes: { in: { x: 2, z: 2 }, out: { x: 6, z: 2, on: 'box:abDoor' }, spare: { x: 3, z: 3 } },
      edges: [['in', 'out', 'abDoor']],
      drop: [['in', 'spare']],
      patrol: ['in', 'out', 'in'],
    },
  })

  it('names what is on a box, the opening that has it as its door, and the nav edge that passes through it', () => {
    expect(access.references(level, 'box', 'abDoor')).toEqual([
      'hotspot knob is on box:abDoor',
      'lamp spot is on box:abDoor',
      'anchor latch is on box:abDoor',
      'node out is on box:abDoor',
      'opening ab: door abDoor',
      'nav edge in–out: door abDoor',
    ])
  })

  it('names the nav edges, drops and patrol that name a node, once for an edge, a drop and the patrol alike', () => {
    expect(access.references(level, 'node', 'in')).toEqual([
      'nav edge in–out: names in',
      'nav drop in–spare: names in',
      'nav patrol: names in',
    ])
    expect(access.references(level, 'node', 'out')).toEqual([
      'nav edge in–out: names out',
      'nav patrol: names out',
    ])
    expect(access.references(level, 'node', 'spare')).toEqual(['nav drop in–spare: names spare'])
  })

  it('has nothing for a thing nothing names, for the spawn and for a wall an item is on', () => {
    expect(access.references(level, 'hotspot', 'knob')).toEqual([])
    expect(access.references(level, 'spawn', 'spawn')).toEqual([])
    expect(access.references(level, 'lamp', 'spot')).toEqual([])
    expect(access.references(level, 'anchor', 'latch')).toEqual([])
    expect(access.references(toyBlockout(), 'box', 'abDoor')).toEqual(['opening ab: door abDoor'])
    expect(access.references(level, 'box', 'a')).toEqual([])
  })

  it('finds them in the shipped files', () => {
    expect(access.references(dawn.level, 'box', 'closetDoor')).toEqual([
      'hotspot closetDoor is on box:closetDoor',
      'nav edge cmid–closet: door closetDoor',
    ])
    expect(access.references(bay.level, 'box', 'mortuaryDoor')).toEqual([
      'hotspot mortuaryDoor is on box:mortuaryDoor',
      'anchor latchBang is on box:mortuaryDoor',
      'opening morDoor: door mortuaryDoor',
      'nav edge morOut–morIn: door mortuaryDoor',
    ])
    expect(access.references(bay.level, 'node', 'drum')).toEqual([
      'nav edge nFoot–drum: names drum',
      'nav patrol: names drum',
    ])
  })
})

describe('the Last Light profile', () => {
  it('writes things through lastLightThingAccess', () => {
    expect(lastLightProfile.things).toBe(access)
  })
})
