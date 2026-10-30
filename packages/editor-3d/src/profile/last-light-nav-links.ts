// Last Light's nav edges as the profile's links (ED3D.7c): an edge joins two authored nav nodes and may pass through a
// door box. What the shipped editor refuses, and in which words, is from The Last Light's editor/src/server/
// level-edits.ts (`handNav`, `addNavEdge`, `removeNav`, 92e6704); a door that is no door box and an edge a walk cannot
// take by the margin with every door open are the `ids` and `nav` checks' own sentences, so an edge the editor adds is
// one the checks pass.
import { edgeDoorProblem } from '../checks/last-light/ids'
import { unclearEdge } from '../checks/last-light/nav-problems'
import type { Blockout, NavEdge } from '../format/blockout.schema'
import { ThingAccessError } from './thing-access'
import type { ThingLink, ThingLinks } from './thing-links'

/** The generator places the nodes and edges of a derived nav: there is nothing to place by hand. */
function byHand(blockout: Blockout): void {
  if (blockout.nav.derive !== false)
    throw new ThingAccessError(
      'this blockout derives its nav from the rooms and openings (nav.derive is not false): the generator places the nodes and edges, so there is nothing to place by hand',
    )
}

const joins = (edge: NavEdge, a: string, b: string): boolean =>
  (edge[0] === a && edge[1] === b) || (edge[0] === b && edge[1] === a)

const withEdges = (blockout: Blockout, edges: readonly NavEdge[]): Blockout => ({
  ...blockout,
  nav: { ...blockout.nav, edges },
})

export const lastLightNavLinks: ThingLinks<Blockout> = {
  def: 'node',

  list: (blockout) =>
    (blockout.nav.edges ?? []).map(
      ([a, b, via]): ThingLink => (via === undefined ? { a, b } : { a, b, via }),
    ),

  add(blockout, { a, b, via }, geometry) {
    byHand(blockout)
    for (const node of [a, b])
      if (!Object.hasOwn(blockout.nav.nodes ?? {}, node)) throw new ThingAccessError(`no nav node ${node}`)
    if (a === b) throw new ThingAccessError('an edge joins two different nodes')
    const edges = blockout.nav.edges ?? []
    if (edges.some((edge) => joins(edge, a, b)))
      throw new ThingAccessError(`there is already an edge ${a}–${b}`)
    const edge: NavEdge = via === undefined ? [a, b] : [a, b, via]
    const problem =
      edgeDoorProblem(edge, blockout.boxes) ??
      geometry.layers.flatMap((layer) => (layer.nav === undefined ? [] : [unclearEdge(layer.nav, edge)]))[0]
    if (problem !== undefined) throw new ThingAccessError(problem)
    return withEdges(blockout, [...edges, edge])
  },

  remove(blockout, a, b) {
    byHand(blockout)
    const edges = blockout.nav.edges ?? []
    if (!edges.some((edge) => joins(edge, a, b))) throw new ThingAccessError(`no nav edge ${a}–${b}`)
    return withEdges(
      blockout,
      edges.filter((edge) => !joins(edge, a, b)),
    )
  },
}
