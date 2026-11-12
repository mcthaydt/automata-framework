import type { Side } from '../body/rig'
import type { CharacterDef } from '../figure/cast'
import type { Gait } from '../motion/motion'
import type { Expression } from '../outfit/garments'
/**
 * Scriptable actors: a character on a timeline. An actor is a script (data, JSON as well as TS): who it is, a path of
 * waypoints (each with a speed or a gait, a wait, stepping in place, a run, a strafe), facing keys, look-at targets (a
 * point or another actor), timed actions from the library (actions.ts), library stands held over a span, an expression
 * and a held item set at times.
 *
 * Everything an actor shows at time t is a pure function of t: where it is, which way it faces, its walk's phase (from
 * the distance it has walked), its actions' envelopes, its blink. There is no clock inside, so a cut, a second shot or a
 * test can sample any moment in any order and get the same frame. It draws through a Figure (figure.ts), as a pose made
 * outside the figure's own motion (`update({ pose, clock })`), at any density, in any of the 8 views.
 *
 * Coordinates: the floor's x and z, facing in radians with 0 toward +z and π/2 toward +x
 * (0 faces the camera); a script's facings are in degrees.
 */
/** A place on the floor (x, z), or a point in the world (x, y, z), or another actor by name. */
export type Target = [number, number] | [number, number, number] | string
export interface Waypoint {
  /** Where it walks to (x, z). */
  at: [number, number]
  /** Its speed (m/s); left out, its gait's own (the run's when it runs). */
  speed?: number
  /** The gait to walk there in: a library gait (library/gaits.json) or a mode of its own gait ('run'). */
  gait?: string
  /** Runs there (its own gait's run). */
  run?: boolean
  /** Keeps its facing (a face key's, else the one it had) and steps sideways or back to get there. */
  strafe?: boolean
  /** On arriving: steps in place for this long (s), then waits `wait` s; `stop` ends the path here. */
  march?: number
  wait?: number
  stop?: boolean
}
/** An action at a time: a library action (library/actions.json) or the motion's own reach and flinch. */
export interface ActionCue {
  t: number
  action: string
  /** Held until (s): a hold action (sit, kneel, fall) stays until then, a looping one (wave) plays on until then. */
  until?: number
  /** Its target: what a point points at, a look looks at, a handshake meets. */
  at?: Target
  /** A sit's seat height (m). */
  seat?: number
  /** The acting hand; left out, the action's own rule (actions.ts ActionDef.hand). */
  side?: Side
}
/** An actor's script. Every field but `who` and `at` may be left out. */
export interface ActorScript {
  /** Its name, for other actors' targets. */
  name?: string
  /** A base figure's id (src/shared/base/base-pair.ts) or a whole character file. */
  who: string | CharacterDef
  outfit?: string
  /** Where it starts (x, z), and its facing there (degrees; left out, toward its first waypoint). */
  at: [number, number]
  facing?: number
  /** When it sets off along the path (s), and the path. */
  start?: number
  path?: Waypoint[]
  /** From each time on, it faces this way (degrees) or toward this target, turning to it. Walking, it faces its way. */
  face?: { t: number; to: number | Target }[]
  /** From each time on, its head (and its chest, and past what they turn, its body) turns to this target; null stops. */
  look?: { t: number; at: Target | null }[]
  actions?: ActionCue[]
  /** A library stand (library/poses.json) held while it stands, from t to `until`. */
  stands?: { t: number; until?: number; pose: string }[]
  expressions?: { t: number; is: Expression }[]
  /** The item in its hand (library/items.json) from t on; null empties it. */
  items?: { t: number; hold: string | null }[]
}
/** What an actor is doing at a moment. */
export interface ActorState {
  /** Where it stands (x, z), its facing (rad) and its speed (m/s). */
  at: [number, number]
  facing: number
  speed: number
  moving: boolean
  /** Walk phase over a two-step cycle (stepped to the gait's poses), the gait, and the feet's heading against the facing. */
  phase: number
  gait: Gait
  heading: number
  march: boolean
}

export interface Seg {
  t0: number
  t1: number
  from: [number, number]
  to: [number, number]
  kind: 'move' | 'march' | 'still'
  gait: Gait
  strafe: boolean
  cycles0: number
  cps: number
  dir: number
}
export interface Turn {
  t: number
  rate: number
  to: (t: number) => number
}
export interface Cue {
  cue: ActionCue
  start: number
  end: number
  cut: number
}

// ─── Placements: the short form of a script ───
/** A figure placed on the floor, the short form of a script: who it is, where it stands (x, z), where it walks to over
 * the clip (`to`, at its gait's speed), its facing (degrees: 0 toward +z, 90 toward +x) and a library stand it holds
 * standing still ('hero' its own lookbook stand). */
export interface Placement {
  who: ActorScript['who']
  at: [number, number]
  to?: [number, number]
  facing?: number
  pose?: string
}
/** What a troupe's caller may cast: a placement or a whole script. */
export type Casting = Placement | ActorScript
