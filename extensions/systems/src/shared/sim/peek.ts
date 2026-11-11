// Peeking, apart from the sim: where the player would peek and how a peek grows. She stands still, within `reach` of the
// middle of a doorway from her camera zone into another, facing it within `arc`; after `dwell` seconds the peek holds and
// leans the camera across the doorway, up to `lean` metres, over `ease` seconds. These are the old game's numbers; the
// pure functions here take what they need as arguments, so each is tested without a sim.
import { atan2, cos, hypot, sin } from '@automata/sim/math'

/** The numbers of a peek. The defaults are the old game's. */
export interface PeekDef {
  /** How near the doorway's middle the player must stand, in metres. */
  readonly reach: number
  /** Seconds still and facing it before the peek holds. */
  readonly dwell: number
  /** The most her facing may be off the doorway, in degrees. */
  readonly arc: number
  /** The offset's full length, in metres. */
  readonly lean: number
  /** Seconds the offset takes to reach it once the dwell is up. */
  readonly ease: number
}

export const DEFAULT_PEEK: PeekDef = { reach: 1.4, dwell: 0.6, arc: 50, lean: 1.2, ease: 0.4 }

/**
 * A peek: the doorway (`from>to`, as pursuit keys a crossing), the room looked into, seconds since she began to dwell,
 * whether the dwell is up (`on`: the camera may lean and the far room shows) and the camera offset.
 */
export interface PeekState {
  readonly portal: string
  readonly into: string
  readonly t: number
  readonly on: boolean
  readonly x: number
  readonly z: number
}

interface Point {
  readonly x: number
  readonly z: number
}

/** A doorway she could peek through: its id, the room beyond, its middle, and a spot just inside that room. */
export interface Doorway {
  readonly portal: string
  readonly into: string
  readonly at: Point
  readonly past: Point
}

/** Rounding that two runs, and two engines, agree on. */
const EPS = 1e-9
/** A literal: `Math.PI` is not bit-exact across engines, and this is the one value the sim math does not export. */
const PI = 3.141592653589793

/** The angle `a` brought within a half turn either way of zero. */
const wrap = (a: number): number => atan2(sin(a), cos(a))

/**
 * Whether a player at `from` facing `facing` (radians; the direction is (sin f, cos f)) would peek through `door`: near
 * enough, on her own side of it, and facing it (on top of it there is no direction to be off).
 */
export function inFront(from: Point, facing: number, door: Doorway, def: PeekDef): boolean {
  const d = hypot(door.at.x - from.x, door.at.z - from.z)
  if (d > def.reach) return false
  // Her own side: not already past the doorway, where the room beyond begins.
  const side =
    (from.x - door.at.x) * (door.past.x - door.at.x) + (from.z - door.at.z) * (door.past.z - door.at.z)
  if (side > 0.05) return false
  if (d <= 0.05) return true
  return Math.abs(wrap(atan2(door.at.x - from.x, door.at.z - from.z) - facing)) <= (def.arc * PI) / 180
}

/** The nearest of `doors` she would peek through, or undefined. A tie goes to the earlier in the list. */
export function peekTarget(
  from: Point,
  facing: number,
  doors: readonly Doorway[],
  def: PeekDef,
  clear: (door: Doorway) => boolean,
): Doorway | undefined {
  let best: Doorway | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const door of doors) {
    const d = hypot(door.at.x - from.x, door.at.z - from.z)
    if (d >= bestDistance || !inFront(from, facing, door, def) || !clear(door)) continue
    best = door
    bestDistance = d
  }
  return best
}

/** Whether a peek has held its dwell: the camera leans and the far room shows. */
export const holds = (state: PeekState | null): boolean => state?.on === true

/**
 * One step of a peek: `door` is the doorway she is peeking through now (none: the peek ends). The dwell counts up from the
 * step she starts, and starts again if she turns to another doorway; the offset points from the doorway's middle across
 * it, growing to `lean` over `ease` once the dwell is up. Nothing is a negative zero.
 */
export function advance(
  previous: PeekState | null,
  door: Doorway | undefined,
  dt: number,
  def: PeekDef,
): PeekState | null {
  if (door === undefined) return null
  const t = (previous?.portal === door.portal ? previous.t : 0) + Math.max(0, dt)
  const grown = def.ease <= 0 ? 1 : Math.min(1, Math.max(0, (t - def.dwell) / def.ease))
  const length = def.lean * grown
  const dx = door.past.x - door.at.x
  const dz = door.past.z - door.at.z
  const across = hypot(dx, dz)
  const unit = across === 0 ? { x: 0, z: 0 } : { x: dx / across, z: dz / across }
  return {
    portal: door.portal,
    into: door.into,
    t,
    on: t >= def.dwell - EPS,
    x: unit.x * length || 0,
    z: unit.z * length || 0,
  }
}
