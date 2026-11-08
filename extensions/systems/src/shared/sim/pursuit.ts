// Pursuit: where the player crosses into another zone, hiding, and who saw her
// hide. The crossing is read from the player's room (`places.roomOf`), which in 3D sectors decides in `cleanup`, so it
// is the room at the end of the last step.
import { type PlanRoom, type PlanPoint as Point, THROUGH } from '@automata/places'
import { sortedKeys } from '@automata/sim'
import { hypot } from '@automata/sim/math'
import type { Crossing } from './systems.resource'
import type { SystemsWorld } from './world'

export { THROUGH }
/** Door-follow's clearance: never within this of the player. */
export const FOLLOW_CLEAR = 1.5
/** Noises the agents never hear: an agent's own footfalls, which are for the player's ears. */
export const UNHEARD: readonly string[] = ['footfall']

export const dist = (a: Point, b: Point): number => hypot(a.x - b.x, a.z - b.z)

/** The zone a point is in (its room's), or undefined off the map. */
export const zoneAt = (w: SystemsWorld, p: Point): string | undefined =>
  w.rooms[w.places.roomAt(w.ctx, p) - 1]?.zone

/** A crossing from room `from` into room `to` through the edge between them, or null when they do not touch. */
export function crossingOf(w: SystemsWorld, from: PlanRoom, to: PlanRoom): Crossing | null {
  const through = w.places.crossing(w.ctx, from.id, to.id)
  return through === null
    ? null
    : {
        portal: `${from.id}>${to.id}`,
        from: from.id,
        to: to.id,
        zone: to.zone,
        x: through.x,
        z: through.z,
        into: through.into,
      }
}

/** A portal by id (`from>to`), as a crossing. */
export function portal(w: SystemsWorld, id: string): Crossing | null {
  const [a, b] = id.split('>')
  const from = w.rooms.find((room) => room.id === a)
  const to = w.rooms.find((room) => room.id === b)
  return from !== undefined && to !== undefined ? crossingOf(w, from, to) : null
}

/** Notes the player's room for this step, and whether she crossed into another zone since the last one. */
export function track(w: SystemsWorld): void {
  const p = w.pursuit
  p.crossed = null
  const index = w.env.player === 0 ? 0 : w.places.roomOf(w.ctx, w.env.player)
  const now = index === 0 ? undefined : w.rooms[index - 1]
  if (now === undefined) return
  if (p.sector !== '' && p.sector !== now.id) {
    const before = w.rooms.find((room) => room.id === p.sector)
    if (before !== undefined && before.zone !== now.zone) {
      const c = crossingOf(w, before, now)
      if (c !== null) {
        p.crossed = c
        p.last = c
      }
    }
  }
  p.sector = now.id
}

/** Hides the player at `spot`, noting every agent as it stands now. */
export function hide(w: SystemsWorld, spot: string): void {
  const p = w.pursuit
  p.hidden = spot
  p.hiddenFor = 0
  p.watchers = {}
  for (const id of sortedKeys(w.state.agents)) {
    const at = w.at[id] as Point
    const mode = w.state.agents[id]?.mode ?? ''
    p.watchers[id] = { x: at.x, z: at.z, mode, los: !w.sight.segment(at, w.player, 0) }
  }
}

export function unhide(w: SystemsWorld): void {
  const p = w.pursuit
  if (p.hidden === '') return
  p.hidden = ''
  p.hiddenFor = 0
  p.watchers = {}
}

/** Whether agent `id` saw the player hide: it stood within `radius` m of her (and, with `los`, in sight past the walls). */
export function saw(
  w: SystemsWorld,
  id: string,
  radius: number,
  los = false,
  still?: (mode: string) => boolean,
): boolean {
  const watcher = w.pursuit.hidden === '' ? undefined : w.pursuit.watchers[id]
  if (watcher === undefined || still?.(watcher.mode) === true) return false
  return dist(watcher, w.player) <= radius && (!los || watcher.los)
}
