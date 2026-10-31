// The walk (M6 spec §4.4, §5), in the `gameplay` phase after input: door changes first, then new `walk-to` routes, then
// every walker in StableId order steps along its route by one stride (speed × dt), carrying what is left of a stride
// past a point onto the next leg. A route is made once, and again only when the doors' version moves (never per tick).
// Sectors' membership runs in `cleanup`, so it sees the moved position on the same step.
import { InSector, type Point, resolvedMap } from '@mcthaydt/automata-sectors/sim'
import { defineSystem, type SimContext, type SystemDef, sortedKeys } from '@mcthaydt/automata-sim'
import { hypot } from '@mcthaydt/automata-sim/math'
import { blockedBy } from './blocked'
import { NavDoor, WalkTo } from './nav.command'
import { NavAgent } from './nav.component'
import { NavArrived, NavUnreachable } from './nav.event'
import { NavDoors, NavGraphResource, type NavRoute, NavRoutes } from './nav.resource'
import { type Blocked, clear, route, WALK_MARGIN } from './route'

export interface NavOptions {
  /** The game's movement query (walls, steps and its own obstacles); by default sectors' walls and nav's doors. */
  readonly blocked?: (ctx: SimContext, doors: Readonly<Record<string, boolean>>) => Blocked
}

type Routes = Record<string, NavRoute>

/** Routes `entity` from `from` to `to`, or emits `nav.unreachable` and drops its route when there is no way. */
function plan(
  ctx: SimContext,
  blocked: Blocked,
  routes: Routes,
  entity: number,
  from: Point,
  to: Point,
  version: number,
) {
  const points = route(from, to, ctx.resource(NavGraphResource), blocked, WALK_MARGIN)
  const first = points[0] as Point
  // `route` falls back to the target alone; if that leg is not clear either, there is no way there.
  if (points.length === 1 && !clear(from, first, blocked, 0)) {
    delete routes[String(entity)]
    ctx.emit(NavUnreachable, { entity, to: { x: to.x, z: to.z } })
    return
  }
  routes[String(entity)] = {
    to: { x: to.x, z: to.z },
    points: points.map((p) => ({ x: p.x, z: p.z })),
    version,
  }
}

export const navWalkSystem = (options: NavOptions): SystemDef =>
  defineSystem('nav.walk', 'gameplay', (ctx) => {
    const doors = ctx.resource(NavDoors)
    for (const { payload } of ctx.commands.of(NavDoor)) {
      if ((doors.open[payload.door] === true) === payload.open) continue
      doors.open[payload.door] = payload.open
      doors.version += 1
    }
    const blocked = options.blocked?.(ctx, doors.open) ?? blockedBy(resolvedMap(ctx), doors.open)
    const routes = ctx.resource(NavRoutes)
    // A walk-to names an entity that nav moves; any other is ignored.
    for (const { payload } of ctx.commands.of(WalkTo)) {
      const walker = ctx.entity(payload.entity)
      if (walker === undefined || !walker.has(NavAgent) || !walker.has(InSector)) continue
      const { x, z } = walker.get(InSector)
      plan(ctx, blocked, routes, payload.entity, { x, z }, payload.to, doors.version)
    }
    for (const key of sortedKeys(routes)) if (ctx.entity(Number(key)) === undefined) delete routes[key]
    for (const walker of ctx.query(NavAgent, InSector)) {
      const key = String(walker.sid)
      let walk = routes[key]
      if (walk === undefined) continue
      const { x, z } = walker.get(InSector)
      if (walk.version !== doors.version) {
        plan(ctx, blocked, routes, walker.sid, { x, z }, walk.to, doors.version)
        walk = routes[key]
        if (walk === undefined) continue
      }
      let here: Point = { x, z }
      let stride = walker.get(NavAgent).speed * ctx.dt
      while (stride > 0 && walk.points.length > 0) {
        const next = walk.points[0] as Point
        const length = hypot(next.x - here.x, next.z - here.z)
        if (length <= stride) {
          here = { x: next.x, z: next.z }
          stride -= length
          walk.points.shift()
        } else {
          const t = stride / length
          here = { x: here.x + (next.x - here.x) * t, z: here.z + (next.z - here.z) * t }
          stride = 0
        }
      }
      walker.set(InSector, { x: here.x, z: here.z })
      if (walk.points.length === 0) {
        delete routes[key]
        ctx.emit(NavArrived, { entity: walker.sid, at: { x: here.x, z: here.z } })
      }
    }
  })
