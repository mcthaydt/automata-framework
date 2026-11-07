// Routes on the clinic (M6 spec §4.4, N-a): the adventure source's three nav tests, re-pointed at the converted clinic,
// plus the determinism rules (sorted scan, ties to the lower id) and the unreachable fallback.
import type { Point } from '@automata/sectors/sim'
import { describe, expect, it } from 'vitest'
import { clinicBlocked, clinicGraph, resolvedClinic } from '../testing/clinic'
import type { NavGraph } from './nav-graph.schema'
import { type Blocked, clear, nearestNode, route } from './route'

const map = resolvedClinic()
const graph = clinicGraph()
const shut = clinicBlocked(map, { closetDoor: false })
const opened = clinicBlocked(map, { closetDoor: true })

describe("the source's nav tests", () => {
  it('routes from the ward into the corridor around the north wall', () => {
    const path = route({ x: -3, z: 3 }, { x: 0, z: -5 }, graph, shut)
    expect(path.at(-1)).toEqual({ x: 0, z: -5 })
    let from: Point = { x: -3, z: 3 }
    for (const point of path) {
      expect(clear(from, point, shut)).toBe(true)
      from = point
    }
  })

  it('the supply room is only reachable once its door is open', () => {
    expect(clear({ x: 0, z: -4 }, { x: 3, z: -4 }, shut)).toBe(false)
    expect(clear({ x: 0.3, z: -4 }, { x: 3, z: -4 }, opened)).toBe(true)
  })

  it('every navigation edge is walkable for a capsule', () => {
    for (const [a, b] of graph.edges)
      expect(clear(graph.nodes[a] as Point, graph.nodes[b] as Point, opened, 0.3), `${a}–${b}`).toBe(true)
  })
})

/** Open floor: nothing blocks except the segments `walls` names. */
const floor = (walls: (a: Point, b: Point) => boolean = () => false): Blocked => ({
  segment: (a, b) => walls(a, b),
  open: () => true,
})

describe('determinism', () => {
  it('breaks a tie between equally near nodes towards the lower id', () => {
    const g: NavGraph = { nodes: { b: { x: 1, z: 0 }, a: { x: -1, z: 0 } }, edges: [['a', 'b']] }
    expect(nearestNode({ x: 0, z: 0 }, g, floor())).toBe('a')
  })

  it('gives the same route when the graph record is written in another order', () => {
    const forward = { ...graph, nodes: Object.fromEntries(Object.entries(graph.nodes)) }
    const backward = { ...graph, nodes: Object.fromEntries(Object.entries(graph.nodes).reverse()) }
    const from = { x: -3, z: 3 }
    const to = { x: 0, z: -5 }
    expect(route(from, to, backward, shut)).toEqual(route(from, to, forward, shut))
  })
})

describe('no route', () => {
  it('has no nearest node when no node is in a clear line', () => {
    expect(
      nearestNode(
        { x: 0, z: 0 },
        graph,
        floor(() => true),
      ),
    ).toBeUndefined()
  })

  it('falls back to the target alone, which the caller finds blocked', () => {
    const walled = floor(() => true)
    expect(route({ x: 0, z: 0 }, { x: 9, z: 9 }, graph, walled)).toEqual([{ x: 9, z: 9 }])
    expect(clear({ x: 0, z: 0 }, { x: 9, z: 9 }, walled)).toBe(false)
  })

  it('does not use an edge whose door is shut', () => {
    const g: NavGraph = {
      nodes: { a: { x: 0, z: 0 }, b: { x: 0, z: 4 }, c: { x: 4, z: 4 } },
      edges: [
        ['a', 'b', 'gate'],
        ['b', 'c'],
      ],
    }
    // Only a node's own leg is clear: a→b, b→c, never a straight walk.
    const legs = (a: Point, b: Point) => !(a.x === b.x || a.z === b.z)
    const gate = (open: boolean): Blocked => ({ segment: legs, open: () => open })
    expect(route({ x: 0, z: 0 }, { x: 4, z: 4 }, g, gate(true))).toEqual([
      { x: 0, z: 4 },
      { x: 4, z: 4 },
      { x: 4, z: 4 },
    ])
    expect(route({ x: 0, z: 0 }, { x: 4, z: 4 }, g, gate(false))).toEqual([{ x: 4, z: 4 }])
  })
})
