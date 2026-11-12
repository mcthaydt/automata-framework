// Which rooms draw: the rooms the camera's zone sees, the room the player stands in, and, for a moment after a zone
// change, the zone just left (so the cut does not pop a room out under the camera's blend). A transition follows the
// accepted camera zones; occupancy additionally protects the player at a threshold.

import { insideSector } from '@automata/3d/level'
import type { PlanPoint, RoomPlan } from './room-level.ts'
import type { RoomPolicy } from './room-policy.schema.ts'

/** Seconds the zone just left stays drawn after a change. */
export const ZONE_HOLD = 0.35

export interface RoomVisibilityInput {
  readonly zone: string
  /** Where the player stands. */
  readonly at: PlanPoint
  /** Seconds since the last update. A negative or non-finite step counts as none. */
  readonly dt: number
  /** A player who asked for reduced motion gets the new zone at once. */
  readonly reducedMotion: boolean
  /** A cutscene draws every room and forgets the zone. */
  readonly cutscene: boolean
  /** A spot whose room shows too: the far side of a peek. */
  readonly also?: PlanPoint | null | undefined
}

export interface RoomVisibility {
  reset(): void
  /** The room a point is in: a list of one, or empty outside every sector. */
  roomsAt(at: PlanPoint): readonly string[]
  /** Starts in a zone at once, with nothing held over. */
  resume(zone: string, at: PlanPoint): ReadonlySet<string>
  /** The rooms to draw this frame. Throws on a zone the policy does not name. */
  update(input: RoomVisibilityInput): ReadonlySet<string>
}

export function createRoomVisibility(policy: RoomPolicy, plans: readonly RoomPlan[]): RoomVisibility {
  const roomOf = new Map(
    Object.entries(policy.rooms).flatMap(([room, ids]) => ids.map((id) => [id, room] as const)),
  )
  let zone: string | undefined
  let retained = new Set<string>()
  let age = 0
  const reset = (): void => {
    zone = undefined
    retained = new Set()
    age = 0
  }
  const roomsAt = (at: PlanPoint): readonly string[] => {
    const plan = plans.find((p) => insideSector(at, p))
    const room = plan && roomOf.get(plan.id)
    return room ? [room] : []
  }
  const resolver: RoomVisibility = {
    reset,
    roomsAt,
    resume: (to, at) => {
      reset()
      return resolver.update({ zone: to, at, dt: 0, reducedMotion: true, cutscene: false })
    },
    update: (input) => {
      if (input.cutscene) {
        reset()
        return new Set(Object.keys(policy.rooms))
      }
      const destination = policy.zones[input.zone]
      if (!destination) throw new Error(`unknown visibility zone ${input.zone}`)
      if (zone === undefined || input.reducedMotion) {
        retained = new Set(destination)
        age = ZONE_HOLD
      } else if (zone !== input.zone) {
        retained = new Set([...retained, ...destination])
        age = 0
      }
      zone = input.zone
      age += Number.isFinite(input.dt) ? Math.max(0, input.dt) : 0
      if (age >= ZONE_HOLD - 1e-9) retained = new Set(destination)
      return new Set([...retained, ...roomsAt(input.at), ...(input.also ? roomsAt(input.also) : [])])
    },
  }
  return resolver
}
