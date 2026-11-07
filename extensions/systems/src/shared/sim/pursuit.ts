// Pursuit: where the player crosses into another zone, hiding, and who saw her
// hide. The crossing is read from the player's `InSector.sector`, which sectors decides in `cleanup`, so it is the
// sector at the end of the last step.
import { InSector, type Point, type Sector } from '@automata/sectors/sim'
import { sortedKeys } from '@automata/sim'
import { hypot } from '@automata/sim/math'
import type { Crossing } from './systems.resource'
import type { SystemsWorld } from './world'

/** How far into the far sector an agent comes through a portal, in metres. */
export const THROUGH = 0.5
/** Door-follow's clearance: never within this of the player. */
export const FOLLOW_CLEAR = 1.5
/** Noises the agents never hear: an agent's own footfalls, which are for the player's ears. */
export const UNHEARD: readonly string[] = ['footfall']

export const dist = (a: Point, b: Point): number => hypot(a.x - b.x, a.z - b.z)

/** The zone a point is in (its sector's), or undefined off the map. */
export const zoneAt = (w: SystemsWorld, p: Point): string | undefined => w.map.sectorAt(p)?.zone

/** A crossing from `from` into `to` through the edge between them, or null when they do not touch. */
export function crossingOf(w: SystemsWorld, from: Sector, to: Sector): Crossing | null {
  const index = w.map.sectors.indexOf(to)
  for (const loop of from.loops)
    for (const edge of loop) {
      if (edge.next !== index) continue
      const x = (edge.a.x + edge.b.x) / 2
      const z = (edge.a.z + edge.b.z) / 2
      // The edge's normal points into `from`: the far side is against it.
      return {
        portal: `${from.id}>${to.id}`,
        from: from.id,
        to: to.id,
        zone: to.zone,
        x,
        z,
        into: { x: x - edge.normal.x * THROUGH, z: z - edge.normal.z * THROUGH },
      }
    }
  return null
}

/** A portal by id (`from>to`), as a crossing. */
export function portal(w: SystemsWorld, id: string): Crossing | null {
  const [a, b] = id.split('>')
  const from = w.map.sectors.find((s) => s.id === a)
  const to = w.map.sectors.find((s) => s.id === b)
  return from !== undefined && to !== undefined ? crossingOf(w, from, to) : null
}

/** Notes the player's sector for this step, and whether she crossed into another zone since the last one. */
export function track(w: SystemsWorld): void {
  const p = w.pursuit
  p.crossed = null
  const index = w.env.player === 0 ? 0 : (w.ctx.entity(w.env.player)?.get(InSector).sector ?? 0)
  const now = index === 0 ? undefined : w.map.sectors[index - 1]
  if (now === undefined) return
  if (p.sector !== '' && p.sector !== now.id) {
    const before = w.map.sectors.find((s) => s.id === p.sector)
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
