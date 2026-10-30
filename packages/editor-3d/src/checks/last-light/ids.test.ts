// The `ids` check of Last Light's `validate` (scripts/pipeline/blockout-lib.ts, 92e6704): names are unique, boxes have
// a role that goes with their kind, what is attached to a box or a wall exists, zones are carved out in order, and the
// nav graph names only nodes and door boxes that exist. Its sentences are Last Light's; each also says where it is.
import { describe, expect, it } from 'vitest'
import type { Blockout } from '../../format/blockout.schema'
import { expand } from '../../format/expand'
import { toyBlockout, toyDoor, toyOpening, toyRoom } from '../../testing/toy-blockout'
import { edgeDoorProblem, idProblems, zoneProblems } from './ids'

const problems = (blockout: Blockout) => idProblems(blockout, expand(blockout))
const messages = (blockout: Blockout) => problems(blockout).map((problem) => problem.message)
const box = (id: string, more: object = {}) => ({
  id,
  role: 'collider' as const,
  kind: 'furniture' as const,
  x: 1,
  z: 3,
  y: 0.4,
  w: 0.5,
  h: 0.8,
  d: 0.5,
  ...more,
})
const hotspot = (id: string, more: object = {}) => ({ id, x: 2, y: 1, z: 3, name: id, reach: 1, ...more })
const lamp = (id: string, more: object = {}) => ({
  id,
  x: 2,
  y: 2,
  z: 3,
  range: 4,
  radius: 1,
  color: [1, 1, 1] as const,
  ...more,
})

describe('idProblems: unique names', () => {
  it('passes the toy level', () => {
    expect(problems(toyBlockout())).toEqual([])
  })

  it('fails a room named twice, rooms and connectors together, and locates the second', () => {
    const twice = toyBlockout({
      rooms: [toyRoom('a'), { ...toyRoom('b'), id: 'a' }],
      openings: [],
      boxes: [],
    })
    const [problem] = idProblems(twice, expand(twice))
    expect(problem?.message).toBe('room a twice')
    expect(problem?.locator).toEqual({ selection: 'sector:a', at: undefined })
    const clash = toyBlockout({ openings: [{ ...toyOpening, id: 'b' }] })
    expect(messages(clash)).toContain('room b twice')
  })

  it('fails a box, a hotspot, a lamp and a zone named twice, each located on the second with the first beside it', () => {
    const toy = toyBlockout()
    const found = problems(
      toyBlockout({
        boxes: [...toy.boxes, box('crate'), box('crate', { x: 3 })],
        hotspots: [...toy.hotspots, hotspot('h'), hotspot('h', { x: 5 })],
        lamps: [lamp('l'), lamp('l', { x: 6 })],
        zones: [
          ...toy.zones,
          { id: 'z', look: [0, 0, 0], distance: 1, area: { x: [0, 1] } },
          { id: 'z', look: [0, 0, 0], distance: 1, area: { x: [1, 2] } },
        ],
      }),
    )
    expect(
      found.map((problem) => [problem.message, problem.locator?.selection, problem.locator?.at]),
    ).toEqual([
      ['box crate twice', 'entity:box/crate', { x: 3, z: 3 }],
      ['hotspot h twice', 'entity:hotspot/h', { x: 5, z: 3 }],
      ['lamp l twice', 'entity:lamp/l', { x: 6, z: 3 }],
      ['zone z twice', 'entity:zone/z', undefined],
    ])
    expect(found[0]?.related).toEqual([{ selection: 'entity:box/crate', at: { x: 1, z: 3 } }])
  })

  it('says a name used three times once', () => {
    const toy = toyBlockout()
    expect(messages(toyBlockout({ boxes: [...toy.boxes, box('c'), box('c'), box('c')] }))).toEqual([
      'box c twice',
    ])
  })
})

describe('idProblems: box roles', () => {
  const toy = toyBlockout()
  it('fails a role that is not collider, seat or door', () => {
    const [problem] = problems(toyBlockout({ boxes: [...toy.boxes, box('crate', { role: 'prop' })] }))
    expect(problem?.message).toBe('box crate: role prop is not collider, seat or door')
    expect(problem?.locator).toEqual({ selection: 'entity:box/crate', at: { x: 1, z: 3 } })
  })

  it('fails a door role on a box that is no door, and a door box without the role', () => {
    expect(messages(toyBlockout({ boxes: [...toy.boxes, box('crate', { role: 'door' })] }))).toEqual([
      'box crate: role door goes with kind door',
    ])
    expect(messages(toyBlockout({ boxes: [{ ...toyDoor, role: 'collider' }] }))).toEqual([
      'box abDoor: role door goes with kind door',
    ])
  })

  it('passes a seat, and a collider, and a door with both', () => {
    expect(messages(toyBlockout({ boxes: [...toy.boxes, box('s', { role: 'seat' }), box('c')] }))).toEqual([])
  })
})

describe('idProblems: what is attached to a box or a wall', () => {
  const toy = toyBlockout()
  it('fails an attachment to a box that is not there, from a hotspot, a lamp, an anchor or a nav node', () => {
    const found = problems(
      toyBlockout({
        hotspots: [hotspot('h', { on: 'box:one' })],
        lamps: [lamp('l', { on: 'box:two' })],
        anchors: { spot: { x: 1, z: 1, on: 'box:three' } },
        nav: { derive: false, nodes: { n: { x: 3, z: 3, on: 'box:four' } } },
      }),
    )
    expect(
      found.map((problem) => [problem.message, problem.locator?.selection, problem.locator?.at]),
    ).toEqual([
      ['box:one: no such box', 'entity:hotspot/h', { x: 2, z: 3 }],
      ['box:two: no such box', 'entity:lamp/l', { x: 2, z: 3 }],
      ['box:three: no such box', 'entity:anchor/spot', { x: 1, z: 1 }],
      ['box:four: no such box', 'entity:node/n', { x: 3, z: 3 }],
    ])
  })

  it('passes an attachment to a box and to a corner of a room that exist', () => {
    expect(
      messages(
        toyBlockout({
          hotspots: [hotspot('h', { on: 'box:abDoor' }), hotspot('g', { on: 'wall:a/3' })],
          lamps: [lamp('l', { on: 'wall:b/0' })],
        }),
      ),
    ).toEqual([])
  })

  it('fails a wall that is no corner of a room: past the last, below the first, of no room, not a number', () => {
    for (const on of ['wall:a/4', 'wall:a/-1', 'wall:nowhere/0', 'wall:a/x', 'wall:a']) {
      expect(messages(toyBlockout({ hotspots: [hotspot('h', { on })] })), on).toEqual([
        `${on}: no such wall (room/corner index)`,
      ])
    }
  })

  it('fails an attachment that is neither, with the way to write one', () => {
    expect(messages(toyBlockout({ hotspots: [hotspot('h', { on: 'floor:x' })] }))).toEqual([
      'floor:x: attach to box:<id> or wall:<room>/<corner>',
    ])
  })

  it('says one sentence once, though two things have it, and locates the first', () => {
    const found = problems(
      toyBlockout({ hotspots: [hotspot('h', { on: 'box:no' })], lamps: [lamp('l', { on: 'box:no' })] }),
    )
    expect(found.map((problem) => [problem.message, problem.locator?.selection])).toEqual([
      ['box:no: no such box', 'entity:hotspot/h'],
    ])
    expect(toy.zones).toHaveLength(1)
  })
})

describe('idProblems: zones', () => {
  const toy = toyBlockout()
  const zone = (id: string, more: object = {}) => ({ id, look: [0, 0, 0] as const, distance: 1, ...more })
  it('fails a level with no zone, with nothing to locate', () => {
    const [problem] = problems(toyBlockout({ zones: [] }))
    expect(problem?.message).toBe('the first zone has no area: it is the rest of the map')
    expect(problem?.locator).toBeUndefined()
  })

  it('fails a first zone with an area, and a later zone without one', () => {
    const first = problems(toyBlockout({ zones: [zone('a', { area: { x: [0, 1] } })] }))
    expect(first.map((problem) => [problem.message, problem.locator?.selection])).toEqual([
      ['the first zone has no area: it is the rest of the map', 'entity:zone/a'],
    ])
    const later = problems(toyBlockout({ zones: [...toy.zones, zone('b')] }))
    expect(later.map((problem) => [problem.message, problem.locator?.selection])).toEqual([
      ['zone b needs an area (only the first zone covers the rest)', 'entity:zone/b'],
    ])
  })

  it('fails a follow outside 0 to 1, and passes 0 and 1', () => {
    expect(messages(toyBlockout({ zones: [zone('a', { follow: 1.5 })] }))).toEqual([
      'zone a: follow 1.5 is outside 0 (fixed) to 1 (the follow camera)',
    ])
    expect(messages(toyBlockout({ zones: [zone('a', { follow: -0.1 })] }))).toEqual([
      'zone a: follow -0.1 is outside 0 (fixed) to 1 (the follow camera)',
    ])
    for (const follow of [0, 1, 0.5])
      expect(messages(toyBlockout({ zones: [zone('a', { follow })] }))).toEqual([])
  })
})

describe('idProblems: the nav graph', () => {
  const nav = { derive: false, nodes: { n1: { x: 1, z: 1 }, n2: { x: 3, z: 3 } } }
  it('fails an edge to a node that is not there, locating the node it does have', () => {
    const found = problems(toyBlockout({ nav: { ...nav, edges: [['n1', 'ghost']] } }))
    expect(
      found.map((problem) => [problem.message, problem.locator?.selection, problem.locator?.at]),
    ).toEqual([['nav: no node ghost', 'entity:node/n1', { x: 1, z: 1 }]])
    const reversed = problems(toyBlockout({ nav: { ...nav, edges: [['ghost', 'n2']] } }))
    expect(reversed[0]?.locator?.selection).toBe('entity:node/n2')
  })

  it('fails a patrol through a node that is not there, with nothing to locate', () => {
    const [problem] = problems(toyBlockout({ nav: { ...nav, patrol: ['n1', 'ghost'] } }))
    expect(problem?.message).toBe('nav: no node ghost')
    expect(problem?.locator).toBeUndefined()
  })

  it('fails an edge through a box that is no door, or no box, at the first node of the edge', () => {
    const toy = toyBlockout()
    for (const door of ['ghostDoor', 'crate']) {
      const found = problems(
        toyBlockout({ boxes: [...toy.boxes, box('crate')], nav: { ...nav, edges: [['n1', 'n2', door]] } }),
      )
      expect(found.map((problem) => [problem.message, problem.locator?.selection])).toEqual([
        [`nav edge n1–n2: ${door} is not a door box`, 'entity:node/n1'],
      ])
    }
    expect(messages(toyBlockout({ nav: { ...nav, edges: [['n1', 'n2', 'abDoor']] } }))).toEqual([])
  })

  it('has the nodes `expand` derives from the rooms and openings', () => {
    expect(messages(toyBlockout({ nav: { edges: [['a', 'b']] } }))).toEqual([])
  })
})

describe('idProblems: places that cannot be named', () => {
  it('reports a problem on a box whose id cannot be in a selection id, without a place', () => {
    const toy = toyBlockout()
    const [problem] = problems(toyBlockout({ boxes: [...toy.boxes, box('a/b', { role: 'prop' })] }))
    expect(problem?.message).toBe('box a/b: role prop is not collider, seat or door')
    expect(problem?.locator).toBeUndefined()
  })
})

describe('the zone and edge sentences the edits share (ED3D.7c)', () => {
  const zone = (id: string, more: object = {}) => ({ id, look: [0, 0, 0] as const, distance: 1, ...more })
  it('zoneProblems says what idProblems says of the zones, located on each zone', () => {
    const found = zoneProblems([
      zone('a', { area: { x: [0, 1] } }),
      zone('b'),
      zone('c', { follow: 2, area: { z: [0, null] } }),
    ])
    expect(found.map((problem) => [problem.message, problem.locator?.selection])).toEqual([
      ['the first zone has no area: it is the rest of the map', 'entity:zone/a'],
      ['zone b needs an area (only the first zone covers the rest)', 'entity:zone/b'],
      ['zone c: follow 2 is outside 0 (fixed) to 1 (the follow camera)', 'entity:zone/c'],
    ])
    expect(zoneProblems([]).map((problem) => problem.message)).toEqual([
      'the first zone has no area: it is the rest of the map',
    ])
    expect(zoneProblems(toyBlockout().zones)).toEqual([])
  })

  it('edgeDoorProblem names an edge through something that is not a door box', () => {
    const boxes = [toyDoor, { ...toyDoor, id: 'desk', kind: 'desk' as const, role: 'collider' as const }]
    expect(edgeDoorProblem(['p', 'q', 'desk'], boxes)).toBe('nav edge p–q: desk is not a door box')
    expect(edgeDoorProblem(['p', 'q', 'nothing'], boxes)).toBe('nav edge p–q: nothing is not a door box')
    expect(edgeDoorProblem(['p', 'q', 'abDoor'], boxes)).toBeUndefined()
    expect(edgeDoorProblem(['p', 'q'], boxes)).toBeUndefined()
  })
})
