// Extracted from The Last Light scripts/pipeline/blockout-lib.ts `ids` (92e6704): names are unique, boxes have a role
// that goes with their kind, what is attached to a box or a wall exists, camera zones are carved out in order, and the
// nav graph names only nodes and door boxes that exist. The sentences are Last Light's; each problem also says where it
// is. (Its last rule, that a lamp kind needs the game's lighting kit, is a fact about the game repo and stays there.)
import type { Blockout, BlockoutBox, NavEdge, ZoneSpec } from '../../format/blockout.schema'
import type { Expanded } from '../../format/expand'
import type { Point } from '../../format/sector.schema'
import { entitySelection, type Locator, locators, type Problem, place, sectorSelection } from '../check'

const ROLES: readonly string[] = ['collider', 'seat', 'door']

const entity = (definition: string, id: string, at?: Point): Locator | undefined =>
  place(() => entitySelection(definition, id), at && { x: at.x, z: at.z })

export function idProblems(blockout: Blockout, expanded: Expanded): Problem[] {
  const problems: Problem[] = []
  const problem = (message: string, locator?: Locator, related?: readonly (Locator | undefined)[]): void => {
    problems.push({ message, locator, related: related && locators(...related) })
  }

  // Each kind of thing has a name once. The sentence is said at the second use, and located there with the first beside it.
  const unique = (kind: string, items: readonly { id: string; locator: Locator | undefined }[]): void => {
    const seen = new Map<string, Locator | undefined>()
    for (const { id, locator } of items) {
      if (seen.has(id)) problem(`${kind} ${id} twice`, locator, [seen.get(id)])
      else seen.set(id, locator)
    }
  }
  unique(
    'room',
    expanded.sectors.map((sector) => ({ id: sector.id, locator: place(() => sectorSelection(sector.id)) })),
  )
  unique(
    'box',
    blockout.boxes.map((box) => ({ id: box.id, locator: entity('box', box.id, box) })),
  )
  unique(
    'hotspot',
    blockout.hotspots.map((hotspot) => ({ id: hotspot.id, locator: entity('hotspot', hotspot.id, hotspot) })),
  )
  unique(
    'lamp',
    blockout.lamps.map((lamp) => ({ id: lamp.id, locator: entity('lamp', lamp.id, lamp) })),
  )
  unique(
    'zone',
    blockout.zones.map((zone) => ({ id: zone.id, locator: entity('zone', zone.id) })),
  )

  for (const box of blockout.boxes) {
    if (!ROLES.includes(box.role))
      problem(`box ${box.id}: role ${box.role} is not collider, seat or door`, entity('box', box.id, box))
    else if ((box.role === 'door') !== (box.kind === 'door'))
      problem(`box ${box.id}: role door goes with kind door`, entity('box', box.id, box))
  }

  // What is attached to a box or a wall: hotspots, lamps, anchors and nav nodes, in that order.
  const holders: { on: string | undefined; locator: Locator | undefined }[] = [
    ...blockout.hotspots.map((hotspot) => ({
      on: hotspot.on,
      locator: entity('hotspot', hotspot.id, hotspot),
    })),
    ...blockout.lamps.map((lamp) => ({ on: lamp.on, locator: entity('lamp', lamp.id, lamp) })),
    ...Object.entries(blockout.anchors ?? {}).map(([name, anchor]) => ({
      on: anchor.on,
      locator: entity('anchor', name, anchor),
    })),
    ...Object.entries(blockout.nav.nodes ?? {}).map(([name, node]) => ({
      on: node.on,
      locator: entity('node', name, node),
    })),
  ]
  for (const { on, locator } of holders) {
    if (on === undefined) continue
    const [kind, ref] = [on.slice(0, on.indexOf(':')), on.slice(on.indexOf(':') + 1)]
    if (kind === 'box' && !blockout.boxes.some((box) => box.id === ref))
      problem(`${on}: no such box`, locator)
    else if (kind === 'wall') {
      const [room, index] = ref.split('/')
      const found = blockout.rooms.find((candidate) => candidate.id === room)
      if (!found || !(Number(index) >= 0 && Number(index) < found.corners.length))
        problem(`${on}: no such wall (room/corner index)`, locator)
    } else if (kind !== 'box') problem(`${on}: attach to box:<id> or wall:<room>/<corner>`, locator)
  }

  problems.push(...zoneProblems(blockout.zones))

  // The nav graph names nodes that exist. An edge locates the node it does have; a patrol has no place of its own.
  const node = (id: string): Locator | undefined =>
    Object.hasOwn(expanded.nodes, id) ? entity('node', id, expanded.nodes[id]) : undefined
  for (const id of expanded.patrol) if (!Object.hasOwn(expanded.nodes, id)) problem(`nav: no node ${id}`)
  for (const [a, b] of expanded.edges) {
    if (!Object.hasOwn(expanded.nodes, a)) problem(`nav: no node ${a}`, node(b))
    if (!Object.hasOwn(expanded.nodes, b)) problem(`nav: no node ${b}`, node(a))
  }
  for (const edge of expanded.edges) {
    const found = edgeDoorProblem(edge, expanded.boxes)
    if (found !== undefined) problem(found, node(edge[0]) ?? node(edge[1]))
  }

  // A sentence is said once, where it first was.
  const said = new Set<string>()
  return problems.filter((found) => !said.has(found.message) && !!said.add(found.message))
}

/**
 * Camera zones: the first covers the rest of the map and the later ones are carved out of it, and a zone's `follow` is
 * from 0 to 1. The zone edits (ED3D.7c) refuse with these sentences too.
 */
export function zoneProblems(zones: readonly ZoneSpec[]): Problem[] {
  const problems: Problem[] = []
  const [firstZone, ...laterZones] = zones
  if (!firstZone || firstZone.area)
    problems.push({
      message: 'the first zone has no area: it is the rest of the map',
      locator: firstZone && entity('zone', firstZone.id),
    })
  for (const zone of laterZones)
    if (!zone.area)
      problems.push({
        message: `zone ${zone.id} needs an area (only the first zone covers the rest)`,
        locator: entity('zone', zone.id),
      })
  // CameraZone.follow: 0 fixed … 1 locked on (1 is the follow camera, D10).
  for (const zone of zones)
    if (zone.follow !== undefined && !(zone.follow >= 0 && zone.follow <= 1))
      problems.push({
        message: `zone ${zone.id}: follow ${zone.follow} is outside 0 (fixed) to 1 (the follow camera)`,
        locator: entity('zone', zone.id),
      })
  return problems
}

/** The sentence for a nav edge through something that is not a door box; nothing for an edge with no door. */
export function edgeDoorProblem(
  edge: NavEdge,
  boxes: readonly Pick<BlockoutBox, 'id' | 'kind'>[],
): string | undefined {
  const [a, b, door] = edge
  return door && !boxes.some((box) => box.id === door && box.kind === 'door')
    ? `nav edge ${a}–${b}: ${door} is not a door box`
    : undefined
}
