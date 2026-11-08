// The scene's places: where each is, which join, and what in the behaviour file names it. A rename changes the places
// file and every reference in the behaviour file; the two files keep separate histories, so it is two undo steps (the
// behaviour file's, which the suite's Undo follows, and the places file's).
import type { ContentEdit } from '@automata/editor/kit/documents'
import type { NavGraph } from '@automata/nav/sim'
import type { SystemsDef } from '@automata/systems/sim'
import { spaced } from './pieces/piece.ts'
import { allEffects, allProbes, type Refused } from './schematic-edits.ts'

type Edge = NavGraph['edges'][number]

const num = (n: number): string => String(Number.parseFloat(n.toFixed(2)))

/** The places a place joins, in the order the file lists the edges. */
export function neighboursOf(nav: NavGraph, place: string): string[] {
  const found: string[] = []
  for (const edge of nav.edges) {
    if (edge[0] === place) found.push(edge[1])
    else if (edge[1] === place) found.push(edge[0])
  }
  return found
}

/** A place as it reads: "bedside: 4 across, 2 down. Walks to desk, door". */
export function placeSentence(nav: NavGraph, place: string): string {
  const at = nav.nodes[place]
  const near = neighboursOf(nav, place)
  const where = at === undefined ? '' : `: ${num(at.x)} across, ${num(at.z)} down`
  return `${spaced(place)}${where}. ${near.length === 0 ? 'Joins nothing yet' : `Walks to ${near.map(spaced).join(', ')}`}`
}

/** The door an edge goes through, in words ("through the ward door"), or `undefined`. */
export const doorWords = (edge: Edge): string | undefined =>
  edge[2] === undefined ? undefined : `through the ${spaced(edge[2])}`

const joins = (edge: Edge, a: string, b: string): boolean =>
  (edge[0] === a && edge[1] === b) || (edge[0] === b && edge[1] === a)

export function addPlaceEdits(nav: NavGraph, name: string, x: number, z: number): ContentEdit[] | Refused {
  const id = name.trim()
  if (id === '') return { refused: 'A place needs a name.' }
  if (id in nav.nodes) return { refused: `There is already a place called “${id}”.` }
  return [{ keyPath: ['nodes', id], insert: { x, z } }]
}

/** One edge between two places; never twice, whichever way round it was written. */
export function connectEdits(nav: NavGraph, a: string, b: string): ContentEdit[] | Refused {
  if (a === b) return { refused: 'A place cannot join itself.' }
  if (!(a in nav.nodes) || !(b in nav.nodes)) return { refused: 'That place is not in this scene any more.' }
  if (nav.edges.some((edge) => joins(edge, a, b))) return { refused: 'Those two places already join.' }
  return [{ keyPath: ['edges'], insert: [a, b] }]
}

export function disconnectEdits(nav: NavGraph, a: string, b: string): ContentEdit[] {
  const index = nav.edges.findIndex((edge) => joins(edge, a, b))
  return index < 0 ? [] : [{ keyPath: ['edges', index], remove: true }]
}

/** What in the behaviour file names `place`, as sentences, for a refusal and for a rename. */
export function namedBy(def: SystemsDef, place: string): string[] {
  const found: string[] = []
  def.agents.forEach((agent) => {
    agent.routine?.forEach((stop, i) => {
      if (stop.node === place) found.push(`${spaced(agent.id)} patrols to it (stop ${i + 1})`)
    })
  })
  for (const { value } of allProbes(def))
    if ('at' in value && value.at === place) found.push('a condition asks if it is there')
  for (const { value } of allEffects(def)) {
    if ('goTo' in value && value.goTo === place) found.push('an action walks to it')
    if ('flee' in value && value.flee === place) found.push('an action runs from it')
    if ('noise' in value && value.noise.at === place) found.push('a noise is made there')
    if ('ambush' in value && value.ambush.at === place) found.push('an ambush waits there')
  }
  return found
}

/** The edits to the places file and to the behaviour file that rename `from` to `to`. */
export function renamePlaceEdits(
  nav: NavGraph,
  def: SystemsDef | undefined,
  from: string,
  to: string,
): { readonly nav: ContentEdit[]; readonly systems: ContentEdit[] } | Refused {
  const id = to.trim()
  if (id === '') return { refused: 'A place needs a name.' }
  if (id !== from && id in nav.nodes) return { refused: `There is already a place called “${id}”.` }
  if (nav.nodes[from] === undefined) return { refused: 'That place is not in this scene any more.' }
  // One edit for the whole table with the key renamed where it stands: removing it and inserting the new name would
  // move the place to the top of the file and rewrite its table as an inline one.
  const renamed = Object.fromEntries(
    Object.entries(nav.nodes).map(([name, node]) => [name === from ? id : name, node]),
  )
  const navEdits: ContentEdit[] =
    id === from ? [] : [{ keyPath: ['nodes'], expected: nav.nodes, set: renamed }]
  nav.edges.forEach((edge, i) => {
    for (const end of [0, 1] as const)
      if (edge[end] === from) navEdits.push({ keyPath: ['edges', i, end], expected: from, set: id })
  })
  const systems: ContentEdit[] = []
  if (def !== undefined) {
    def.agents.forEach((agent, a) => {
      agent.routine?.forEach((stop, i) => {
        if (stop.node === from)
          systems.push({ keyPath: ['agents', a, 'routine', i, 'node'], expected: from, set: id })
      })
    })
    for (const { value, path } of allProbes(def))
      if ('at' in value && value.at === from)
        systems.push({ keyPath: [...path, 'at'], expected: from, set: id })
    for (const { value, path } of allEffects(def)) {
      if ('goTo' in value && value.goTo === from)
        systems.push({ keyPath: [...path, 'goTo'], expected: from, set: id })
      if ('flee' in value && value.flee === from)
        systems.push({ keyPath: [...path, 'flee'], expected: from, set: id })
      if ('noise' in value && value.noise.at === from)
        systems.push({ keyPath: [...path, 'noise', 'at'], expected: from, set: id })
      if ('ambush' in value && value.ambush.at === from)
        systems.push({ keyPath: [...path, 'ambush', 'at'], expected: from, set: id })
    }
  }
  return { nav: navEdits, systems }
}

/** Taking a place away: refused, with what names it, while anything does; else its node and its edges go. */
export function removePlaceEdits(
  nav: NavGraph,
  def: SystemsDef | undefined,
  place: string,
): ContentEdit[] | Refused {
  const users = def === undefined ? [] : namedBy(def, place)
  if (users.length > 0)
    return { refused: `Something still uses “${spaced(place)}”: ${users.join('; ')}. Change that first.` }
  const edges: ContentEdit[] = []
  for (let i = nav.edges.length - 1; i >= 0; i -= 1) {
    const edge = nav.edges[i]
    if (edge !== undefined && (edge[0] === place || edge[1] === place))
      edges.push({ keyPath: ['edges', i], remove: true })
  }
  return [...edges, { keyPath: ['nodes', place], remove: true }]
}
