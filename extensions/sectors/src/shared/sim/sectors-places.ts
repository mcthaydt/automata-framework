// `sectorsPlaces`: the sectors extension as the plan `narrative`, `nav` and `systems` read. Every answer is what those
// extensions read from sectors before the contract existed (`InSector`, the resolved map, `blockedBy`, systems' own
// crossing maths), so a 3D game sees exactly what it always saw. A position is the walker's `InSector`, which the game
// writes; the room is the membership sectors decides at the end of each step.
import { crossingThrough, type Places, type PlanCrossing, type PlanRoom } from '@automata/places'
import type { SimContext } from '@automata/sim'
import { blockedBy } from './blocked'
import { resolvedMap } from './resolved-map'
import { InSector } from './sectors.component'

const rooms = (ctx: SimContext): readonly PlanRoom[] =>
  resolvedMap(ctx).sectors.map((sector) => ({ id: sector.id, zone: sector.zone }))

export const sectorsPlaces: Places = {
  provider: 'sectors',
  at(ctx, sid) {
    const walker = ctx.entity(sid)
    if (walker === undefined || !walker.has(InSector)) return undefined
    const { x, z } = walker.get(InSector)
    return { x, z }
  },
  move(ctx, sid, to) {
    ctx.entity(sid)?.set(InSector, { x: to.x, z: to.z })
  },
  spawnAt: (p) => [[InSector, { x: p.x, z: p.z }]],
  rooms,
  roomAt(ctx, p) {
    const map = resolvedMap(ctx)
    const here = map.sectorAt(p)
    return here === undefined ? 0 : map.sectors.indexOf(here) + 1
  },
  roomOf(ctx, sid) {
    const walker = ctx.entity(sid)
    return walker === undefined || !walker.has(InSector) ? 0 : walker.get(InSector).sector
  },
  walk: (ctx, doors) => blockedBy(resolvedMap(ctx), doors),
  // Sight past the walls is the walls: the same test, with the same doors.
  sight: (ctx, doors) => blockedBy(resolvedMap(ctx), doors),
  crossing(ctx, from, to): PlanCrossing | null {
    const map = resolvedMap(ctx)
    const source = map.sectors.find((sector) => sector.id === from)
    const target = map.sectors.find((sector) => sector.id === to)
    if (source === undefined || target === undefined) return null
    const index = map.sectors.indexOf(target)
    for (const loop of source.loops)
      for (const edge of loop) {
        if (edge.next !== index) continue
        // The edge's normal points into `source`: the far side is against it.
        return crossingThrough({ x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 }, edge.normal)
      }
    return null
  },
}
