// Extracted from The Last Light scripts/pipeline/blockout-lib.ts, the `nav` check (92e6704): the authored nodes are in a
// room and out of every box, each nav edge is clear by 0.3 m with every door open, and a walk from the spawn gets
// within reach of every hotspot (the scene tests' rule). The sentences, the numbers and the order are Last Light's;
// each problem also says where it is.
import type { Blockout } from '../../format/blockout.schema'
import type { Box, Expanded } from '../../format/expand'
import type { Point } from '../../format/sector.schema'
import { clear, navWorld, nearestNode, openDoors } from '../../geometry/nav'
import { type ResolvedMap, sectorAt } from '../../geometry/sectors'
import { entitySelection, type Locator, locators, type Problem, place, sectorSelection } from '../check'

/** How far from a wall or a box a walk, and a place to stand, must be. */
const MARGIN = 0.3

export function navProblems(blockout: Blockout, expanded: Expanded, map: ResolvedMap): Problem[] {
  const world = navWorld(map, expanded)
  const open = openDoors(expanded)
  const problems: Problem[] = []

  /** The first box that is not a door whose footprint, grown by `margin`, holds the point. */
  const boxAround = (point: Point, margin: number): Box | undefined =>
    expanded.boxes.find(
      (box) =>
        box.kind !== 'door' &&
        Math.abs(point.x - box.x) < box.w / 2 + margin &&
        Math.abs(point.z - box.z) < box.d / 2 + margin,
    )

  // An authored node is an entity of the document. A derived one is not (a room's pole, named for the room, or the point
  // half a metre inside a room beside an opening, named `<opening>:<room>`), so the room it stands in is what to point at.
  const authored = new Set(Object.keys(blockout.nav.nodes ?? {}))
  const rooms = new Set(expanded.sectors.map((sector) => sector.id))
  const nodePlace = (id: string, at: Point): Locator | undefined => {
    if (authored.has(id)) return place(() => entitySelection('node', id), at)
    const room = id.slice(id.lastIndexOf(':') + 1)
    return rooms.has(room) ? place(() => sectorSelection(room), at) : undefined
  }

  for (const [id, point] of Object.entries(expanded.nodes)) {
    if (!sectorAt(map, point)) {
      problems.push({ message: `node ${id} is outside every room`, locator: nodePlace(id, point) })
      continue
    }
    const box = boxAround(point, 0)
    if (box)
      problems.push({
        message: `node ${id} is inside box ${box.id}`,
        locator: nodePlace(id, point),
        related: locators(place(() => entitySelection('box', box.id), { x: box.x, z: box.z })),
      })
  }

  // An edge to a node that is not there is `ids`' to report.
  for (const [a, b] of expanded.edges) {
    const from = expanded.nodes[a]
    const to = expanded.nodes[b]
    if (from && to && !clear(world, from, to, open, MARGIN))
      problems.push({
        message: `edge ${a}–${b} is not clear by ${MARGIN} m with the doors open`,
        locator: nodePlace(a, from),
        related: locators(nodePlace(b, to)),
      })
  }

  const { spawn } = expanded
  const start = nearestNode(world, spawn, open)
  if (start === null) {
    problems.push({
      message: 'no node is reachable from the spawn',
      locator: place(() => entitySelection('spawn', 'spawn'), { x: spawn.x, z: spawn.z }),
    })
    return problems
  }

  // The nodes a walk from the spawn gets to, along the authored edges.
  const seen = new Set([start])
  const queue = [start]
  // A queue that grows as it is walked, which `for…of` follows to the end.
  for (const node of queue)
    for (const [a, b] of expanded.edges) {
      const next = a === node ? b : b === node ? a : null
      if (next && !seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  const walked = [...seen].flatMap((id) => expanded.nodes[id] ?? [])

  const free = (point: Point): boolean => sectorAt(map, point) !== undefined && !boxAround(point, MARGIN)
  /** A place to stand on one of rings 0.35 m out, in steps of 0.1 m, to 0.8 of the hotspot's reach, in 32 directions. */
  const canStandNear = (hotspot: Expanded['hotspots'][number]): boolean => {
    for (let radius = 0.35; radius <= hotspot.reach * 0.8; radius += 0.1)
      for (let step = 0; step < 32; step++) {
        const angle = (step / 32) * Math.PI * 2
        const spot = { x: hotspot.x + Math.cos(angle) * radius, z: hotspot.z + Math.sin(angle) * radius }
        if (free(spot) && walked.some((node) => clear(world, node, spot, open, MARGIN))) return true
      }
    return false
  }
  for (const hotspot of expanded.hotspots)
    if (!canStandNear(hotspot))
      problems.push({
        message: `hotspot ${hotspot.id} cannot be reached from the spawn within ${hotspot.reach} m`,
        locator: place(() => entitySelection('hotspot', hotspot.id), { x: hotspot.x, z: hotspot.z }),
      })
  return problems
}
