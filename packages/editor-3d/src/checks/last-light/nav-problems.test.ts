// The nav check of Last Light's `validate` (`nav`, scripts/pipeline/blockout-lib.ts, 92e6704): the authored nodes are in
// rooms and out of boxes, each edge is clear by 0.3 m with every door open, and from the spawn a walk reaches every
// hotspot within 0.8 of its reach.
import { describe, expect, it } from 'vitest'
import type { Blockout, BlockoutBox, BlockoutHotspot, NavEdge } from '../../format/blockout.schema'
import { expand } from '../../format/expand'
import { resolveMap } from '../../geometry/sectors'
import { must, toyBlockout, toyDoor, toyOpening } from '../../testing/toy-blockout'
import { navProblems } from './nav-problems'

// The toy's nodes are a (2, 2), ab:a (3.5, 2), ab:b (4.625, 2) and b (5.57, 1.45), and its edges join them in that
// order, the one across the doorway through the door. Its spawn is (1, 1) and its one hotspot is `far`, at (6, 3).
const problems = (blockout: Blockout) => {
  const expanded = expand(blockout)
  return navProblems(blockout, expanded, resolveMap(expanded.sectors, expanded.masses))
}
const messages = (blockout: Blockout) => problems(blockout).map((problem) => problem.message)

const crate = (more: Partial<BlockoutBox> = {}): BlockoutBox => ({
  id: 'crate',
  role: 'collider',
  kind: 'furniture',
  x: 2.75,
  z: 2,
  y: 0.4,
  w: 0.3,
  h: 0.8,
  d: 0.3,
  ...more,
})
const withBoxes = (...boxes: BlockoutBox[]): Blockout => toyBlockout({ boxes: [toyDoor, ...boxes] })
const withNodes = (nodes: Record<string, { x: number; z: number }>, more: Partial<Blockout> = {}): Blockout =>
  toyBlockout({ nav: { nodes }, ...more })
/** The toy's derived nav, written out as authored nodes (a box moves a room's derived pole; an authored node stays). */
const walked = (blockout: Blockout): Blockout => ({
  ...blockout,
  nav: {
    derive: false,
    nodes: { p: { x: 2, z: 2 }, q: { x: 3.5, z: 2 }, s: { x: 4.625, z: 2 }, r: { x: 5.57, z: 1.45 } },
    edges: [
      ['p', 'q'],
      ['q', 's', 'abDoor'],
      ['s', 'r'],
    ],
  },
})
const withCrate = (more: Partial<BlockoutBox>): Blockout => withBoxes(crate(more))
const far = must(toyBlockout().hotspots[0])
const withHotspot = (more: Partial<BlockoutHotspot>, ...boxes: BlockoutBox[]): Blockout =>
  toyBlockout({ hotspots: [{ ...far, ...more }], boxes: [toyDoor, ...boxes] })

describe('navProblems: nodes', () => {
  it('passes the toy: its derived nodes are in the rooms, its edges are clear and its hotspot is in reach', () => {
    expect(problems(toyBlockout())).toEqual([])
  })

  it('fails a node outside every room, locating the node', () => {
    const [problem, ...rest] = problems(withNodes({ stray: { x: -5, z: 2 } }))
    expect(problem?.message).toBe('node stray is outside every room')
    expect(problem?.locator).toEqual({ selection: 'entity:node/stray', at: { x: -5, z: 2 } })
    expect(rest).toEqual([])
  })

  it('does not take the gap between two rooms for a room, but takes the doorway connector for one', () => {
    // The rooms are at x 4 and 4.125; only the doorway's connector spans the gap, at z 1.5 to 2.5.
    expect(messages(withNodes({ gap: { x: 4.06, z: 0.2 } }))).toEqual(['node gap is outside every room'])
    expect(messages(withNodes({ threshold: { x: 4.0625, z: 2.2 } }))).toEqual([])
  })

  it('fails a node inside a box that is not a door, naming the first box that holds it', () => {
    const blockout = withNodes(
      { post: { x: 1.5, z: 3 } },
      {
        boxes: [toyDoor, crate({ x: 1.5, z: 3, w: 0.6, d: 0.6 }), crate({ id: 'second', x: 1.5, z: 3 })],
      },
    )
    const [problem, ...rest] = problems(blockout)
    expect(problem?.message).toBe('node post is inside box crate')
    expect(problem?.locator).toEqual({ selection: 'entity:node/post', at: { x: 1.5, z: 3 } })
    expect(problem?.related).toEqual([{ selection: 'entity:box/crate', at: { x: 1.5, z: 3 } }])
    expect(rest).toEqual([])
  })

  it('takes the face of a box as outside it, along either axis, and a node in a door box as in the clear', () => {
    // The crate is 0.5 m square at (1.5, 3): its faces are at x 1.25 and 1.75, and at z 2.75 and 3.25.
    const at = (x: number, z: number) =>
      withNodes({ post: { x, z } }, { boxes: [toyDoor, crate({ x: 1.5, z: 3, w: 0.5, d: 0.5 })] })
    expect(messages(at(1.74, 3))).toEqual(['node post is inside box crate'])
    expect(messages(at(1.75, 3))).toEqual([])
    expect(messages(at(1.5, 3.24))).toEqual(['node post is inside box crate'])
    expect(messages(at(1.5, 3.25))).toEqual([])
    // Half the size, not the whole: 0.4 m from the middle is outside a crate 0.5 m square.
    expect(messages(at(1.9, 3))).toEqual([])
    expect(messages(at(1.5, 3.4))).toEqual([])
    expect(messages(withNodes({ post: { x: 4.0625, z: 2 } }))).toEqual([])
  })

  it('reports a node that is outside every room and in a box as outside only', () => {
    const blockout = withNodes({ stray: { x: -5, z: 2 } }, { boxes: [toyDoor, crate({ x: -5, z: 2 })] })
    expect(messages(blockout)).toEqual(['node stray is outside every room'])
  })
})

describe('navProblems: edges', () => {
  it('fails an edge a box stands in, locating its first node', () => {
    const blockout = withBoxes(crate())
    const [problem, ...rest] = problems(blockout)
    expect(problem?.message).toBe('edge a–ab:a is not clear by 0.3 m with the doors open')
    // Neither node is in the document, which derives them: the room each stands in is what to point at. (The crate moves
    // the room's pole, so the point is the expanded one.)
    const { a, 'ab:a': side } = expand(blockout).nodes
    expect(problem?.locator).toEqual({ selection: 'sector:a', at: a })
    expect(problem?.related).toEqual([{ selection: 'sector:a', at: side }])
    expect(rest).toEqual([])
  })

  it('points at the room a derived node beside an opening stands in, whatever the opening is called', () => {
    // The node `<opening>:<room>` is named for the last part, even when the opening's name holds a colon of its own.
    const colon = toyBlockout({
      openings: [{ ...toyOpening, id: 'north:door' }],
      boxes: [toyDoor, crate()],
    })
    const [problem] = problems(colon)
    expect(problem?.message).toBe('edge a–north:door:a is not clear by 0.3 m with the doors open')
    expect(problem?.related?.map((place) => place.selection)).toEqual(['sector:a'])
  })

  it('locates an edge by its authored nodes, which are entities of the document', () => {
    const [problem, ...rest] = problems(walked(withCrate({})))
    expect(problem?.message).toBe('edge p–q is not clear by 0.3 m with the doors open')
    expect(problem?.locator).toEqual({ selection: 'entity:node/p', at: { x: 2, z: 2 } })
    expect(problem?.related).toEqual([{ selection: 'entity:node/q', at: { x: 3.5, z: 2 } }])
    expect(rest).toEqual([])
  })

  it('wants 0.3 m between an edge and a box: a face 0.25 m away is too near, one 0.35 m away is clear', () => {
    // The crate is 0.3 m deep and the edge runs along z = 2.
    const blocked = ['edge p–q is not clear by 0.3 m with the doors open']
    expect(messages(walked(withCrate({ z: 2.4 })))).toEqual(blocked)
    expect(messages(walked(withCrate({ z: 2.5 })))).toEqual([])
    expect(messages(walked(withCrate({ z: 1.6 })))).toEqual(blocked)
    expect(messages(walked(withCrate({ z: 1.5 })))).toEqual([])
  })

  it('wants 0.3 m between an edge and a wall', () => {
    // A node beside the room's north wall (z = 0), joined to the room's pole and to the doorway: the walks run along it.
    const along = (z: number): Blockout =>
      toyBlockout({
        nav: {
          nodes: { beside: { x: 3, z } },
          edges: [
            ['a', 'beside'],
            ['beside', 'ab:a'],
          ],
        },
      })
    const near = problems(along(0.25))
    expect(near.map((problem) => problem.message)).toEqual([
      'edge a–beside is not clear by 0.3 m with the doors open',
      'edge beside–ab:a is not clear by 0.3 m with the doors open',
    ])
    // An authored node is an entity of the document, which is what to point at; the room's pole is not.
    expect(near.map((problem) => problem.locator?.selection)).toEqual(['sector:a', 'entity:node/beside'])
    expect(near.map((problem) => problem.related?.map((place) => place.selection))).toEqual([
      ['entity:node/beside'],
      ['sector:a'],
    ])
    expect(messages(along(0.35))).toEqual([])
  })

  it('has every door open: the toy walks through its door, and shut it could not', () => {
    // The door box stands across the edge between the doorway's two sides, which the toy passes.
    expect(problems(toyBlockout())).toEqual([])
    // A door box no edge names is open all the same, since every door box is.
    const loose = withBoxes({ ...toyDoor, id: 'loose', x: 2.75, z: 2, w: 0.12, d: 1 })
    expect(messages(loose)).toEqual([])
    // A crate of the same shape, which is furniture, is not.
    expect(messages(withBoxes(crate({ id: 'loose', x: 2.75, z: 2, w: 0.12, d: 1 })))).toHaveLength(1)
  })

  it('says nothing of an edge to a node that is not there, which `ids` reports, and does not fail on it', () => {
    const edges: NavEdge[] = [
      ['a', 'ghost'],
      ['ghost', 'b'],
    ]
    expect(problems(toyBlockout({ nav: { edges } }))).toEqual([])
  })

  it('reports nodes, then edges, then the hotspots, in the order the document lists them', () => {
    const blockout = withNodes(
      { stray: { x: -5, z: 2 }, other: { x: -6, z: 2 } },
      { boxes: [toyDoor, crate()], hotspots: [{ ...far, z: 20 }] },
    )
    expect(messages(blockout)).toEqual([
      'node stray is outside every room',
      'node other is outside every room',
      'edge a–ab:a is not clear by 0.3 m with the doors open',
      'hotspot far cannot be reached from the spawn within 1.4 m',
    ])
  })
})

describe('navProblems: from the spawn', () => {
  it('fails a spawn that no node is reachable from, locating the spawn', () => {
    const [problem, ...rest] = problems(toyBlockout({ spawn: { x: 500, y: 0.79, z: 500, facing: 0 } }))
    expect(problem?.message).toBe('no node is reachable from the spawn')
    expect(problem?.locator).toEqual({ selection: 'entity:spawn/spawn', at: { x: 500, z: 500 } })
    // With no start there is no search, so nothing is said of the hotspots.
    expect(rest).toEqual([])
  })

  it('wants the spawn 0.2 m clear of the walls to see a node', () => {
    const at = (x: number) => toyBlockout({ spawn: { x, y: 0.79, z: 2, facing: 0 } })
    expect(messages(at(0.15))).toEqual(['no node is reachable from the spawn'])
    expect(messages(at(0.25))).toEqual([])
  })

  it('has the doors open when it looks for the node nearest the spawn', () => {
    // The only node is past the door. With the door shut the spawn could not see it.
    const past = toyBlockout({
      spawn: { x: 3, y: 0.79, z: 2, facing: 0 },
      nav: { derive: false, nodes: { s: { x: 4.625, z: 2 } } },
    })
    expect(messages(past)).toEqual([])
  })

  it('fails a hotspot that has no spot to stand in reach of the places the walk gets to', () => {
    const [problem, ...rest] = problems(withHotspot({ z: 20 }))
    expect(problem?.message).toBe('hotspot far cannot be reached from the spawn within 1.4 m')
    expect(problem?.locator).toEqual({ selection: 'entity:hotspot/far', at: { x: 6, z: 20 } })
    expect(rest).toEqual([])
  })

  it('looks for a place to stand from 0.35 m out to 0.8 of the hotspot’s reach', () => {
    // The nearest place is 0.35 m out, so a reach of 0.4 (0.32 m) finds none and one of 0.5 (0.4 m) does.
    expect(messages(withHotspot({ reach: 0.4 }))).toEqual([
      'hotspot far cannot be reached from the spawn within 0.4 m',
    ])
    expect(messages(withHotspot({ reach: 0.5 }))).toEqual([])
  })

  it('wants the place to stand to be 0.3 m from every box, which a hotspot on furniture pushes out', () => {
    // A 1 m crate under the hotspot: standing needs 0.8 m from its middle along an axis, which the ring 0.85 m out gives
    // and 0.8 of a reach of 1.05 (0.84 m) does not get to.
    const counter = crate({ id: 'counter', x: 6, z: 3, w: 1, d: 1 })
    expect(messages(withHotspot({ reach: 1.05 }, counter))).toEqual([
      'hotspot far cannot be reached from the spawn within 1.05 m',
    ])
    expect(messages(withHotspot({ reach: 1.1 }, counter))).toEqual([])
  })

  it('wants the place to stand to be 0.3 m from a wall, so a hotspot in a window reaches out further', () => {
    // The hotspot is 0.2 m beyond the north wall (z = 4): the ring 0.35 m out has its nearest place 0.15 m inside it.
    expect(messages(withHotspot({ z: 4.2, reach: 0.5 }))).toEqual([
      'hotspot far cannot be reached from the spawn within 0.5 m',
    ])
    expect(messages(withHotspot({ z: 4.2, reach: 0.8 }))).toEqual([])
  })

  it('wants the place to stand to be in a room, though the walk may reach outside', () => {
    // A node outside the rooms, joined to room a and with a hotspot beside it that nothing in a room can stand near.
    const outside = toyBlockout({
      nav: {
        nodes: { stray: { x: -5, z: 2 } },
        edges: [['a', 'stray']],
      },
      hotspots: [{ ...far, id: 'outside', x: -5, z: 3 }],
    })
    expect(messages(outside)).toEqual([
      'node stray is outside every room',
      'edge a–stray is not clear by 0.3 m with the doors open',
      'hotspot outside cannot be reached from the spawn within 1.4 m',
    ])
  })

  it('has the doors open when it looks for a place to stand', () => {
    // The walk reaches nodes p and q only, in room a. The hotspot is just past the door, and q sees every place near it
    // through the doorway and the door in it.
    const near = toyBlockout({
      nav: {
        derive: false,
        nodes: { p: { x: 2, z: 2 }, q: { x: 3.5, z: 2 } },
        edges: [['p', 'q']],
      },
      hotspots: [{ ...far, x: 4.9, z: 2, reach: 0.6 }],
    })
    expect(messages(near)).toEqual([])
  })

  it('reaches hotspots only along the edges, whether or not they are clear, and along them either way', () => {
    // Two rooms with a wall between them and no doorway: the walk from the spawn stays in room a, and the hotspot is in b.
    const apart = { openings: [], boxes: [] }
    expect(messages(toyBlockout(apart))).toEqual([
      'hotspot far cannot be reached from the spawn within 1.4 m',
    ])
    // An edge from a to b, which goes through the wall, is a problem of its own and still takes the walk there, however
    // it is written.
    for (const edge of [
      ['a', 'b'],
      ['b', 'a'],
    ] as const)
      expect(messages(toyBlockout({ ...apart, nav: { edges: [edge] } }))).toEqual([
        `edge ${edge.join('–')} is not clear by 0.3 m with the doors open`,
      ])
  })
})
