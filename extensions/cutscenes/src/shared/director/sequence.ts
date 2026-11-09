// How each kind of row in a script reads at a time. Every keyed row is a track on the one timeline
// (`@automata/3d/timeline`), so a camera, a door and a figure's clip all ease the same way; this file turns a placed script
// into those tracks once and reads them. Everything here is pure: the shake and the shiver are fixed sines.

import { bracket, type Ease, type Mix, mixNumber, sample, type Track, track } from '@automata/3d/timeline'
import type { PlacedActorKey, PlacedScript } from '../sim/anchors'
import type { V3 } from '../sim/cutscene.schema'
import type { ActorFrame } from './scene-state'

/** The play lens, 50 mm, which a camera key with no lens keeps. */
export const CUTSCENE_LENS = 50
/** Vertical field of view, in degrees, of a focal length in mm on a 24 mm frame. */
export const fovOf = (lens: number): number => (2 * Math.atan(12 / lens) * 180) / Math.PI

/** The ease of a key that names none: the cutscene default, unlike a clip's (linear). */
const DEFAULT_EASE: Ease = 'smooth'

const mixV3: Mix<V3> = (a, b, u) => [
  mixNumber(a[0], b[0], u),
  mixNumber(a[1], b[1], u),
  mixNumber(a[2], b[2], u),
]

export interface CameraPose {
  readonly pos: V3
  readonly look: V3
  readonly lens: number
}
const mixPose: Mix<CameraPose> = (a, b, u) => ({
  pos: mixV3(a.pos, b.pos, u),
  look: mixV3(a.look, b.look, u),
  lens: mixNumber(a.lens, b.lens, u),
})

/** A prop's pose at a time; see `PropKey`. */
export interface PropPose {
  readonly at?: V3 | undefined
  readonly turn?: number | undefined
  readonly hidden?: boolean | undefined
}
/** The pose a key gives, with only the fields it names. */
function propPose(k: {
  readonly at?: V3 | undefined
  readonly turn?: number | undefined
  readonly hidden?: boolean | undefined
}): PropPose {
  return {
    ...(k.at === undefined ? {} : { at: k.at }),
    ...(k.turn === undefined ? {} : { turn: k.turn }),
    ...(k.hidden === undefined ? {} : { hidden: k.hidden }),
  }
}
/** A field moves only when both keys name it, and a prop is hidden from its key on, so the earlier key's says until then. */
const mixProp: Mix<PropPose> = (a, b, u) => {
  const out: { at?: V3; turn?: number; hidden?: boolean } = {}
  const at = a.at !== undefined && b.at !== undefined ? mixV3(a.at, b.at, u) : a.at
  const turn = a.turn !== undefined && b.turn !== undefined ? mixNumber(a.turn, b.turn, u) : a.turn
  if (at !== undefined) out.at = at
  if (turn !== undefined) out.turn = turn
  if (a.hidden !== undefined) out.hidden = a.hidden
  return out
}

/** The tracks of a script, grouped by what they drive. Built once per director. */
export interface Sequence {
  readonly camera: Track<CameraPose>
  readonly fade: Track<number>
  readonly lamps: ReadonlyMap<string, Track<number>>
  readonly doors: ReadonlyMap<string, Track<number>>
  readonly props: ReadonlyMap<string, Track<PropPose>>
  /** The keys of each actor, by `who`, with the ease each is arrived at. */
  readonly actors: ReadonlyMap<string, readonly EasedActorKey[]>
  readonly time: Track<string>
  readonly grade: Track<string>
}
type EasedActorKey = PlacedActorKey & { readonly ease: Ease }

/** The rows of one name grouped into a track each, in name order. */
function perName<R extends { readonly t: number }, V>(
  rows: readonly R[] | undefined,
  nameOf: (row: R) => string,
  row: (r: R) => readonly [number, V, Ease?],
): ReadonlyMap<string, Track<V>> {
  const grouped = new Map<string, (readonly [number, V, Ease?])[]>()
  for (const r of rows ?? []) {
    const name = nameOf(r)
    grouped.set(name, [...(grouped.get(name) ?? []), row(r)])
  }
  return new Map([...grouped].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, list]) => [name, track(list)]))
}

export function sequenceOf(script: PlacedScript): Sequence {
  const base = script.lens ?? CUTSCENE_LENS
  const actors = new Map<string, EasedActorKey[]>()
  for (const key of script.actor ?? []) {
    // A key that cuts arrives with no easing (its position, facing and `moving` all wait for its time).
    const eased: EasedActorKey = { ...key, ease: key.cut === true ? 'step' : DEFAULT_EASE }
    actors.set(key.who, [...(actors.get(key.who) ?? []), eased])
  }
  return {
    camera: track(
      script.camera.map((k): [number, CameraPose, Ease] => [
        k.t,
        { pos: k.pos, look: k.look, lens: k.lens ?? base },
        k.cut === true ? 'step' : (k.ease ?? DEFAULT_EASE),
      ]),
    ),
    fade: track((script.fade ?? []).map((k): [number, number, Ease] => [k.t, k.value, DEFAULT_EASE])),
    lamps: perName(
      script.light,
      (k) => k.lamp,
      (k) => [k.t, k.level, DEFAULT_EASE],
    ),
    doors: perName(
      script.doors,
      (k) => k.door,
      (k) => [k.t, k.open, k.ease ?? DEFAULT_EASE],
    ),
    props: perName(
      script.props,
      (k) => k.prop,
      (k) => [k.t, propPose(k), k.ease ?? DEFAULT_EASE],
    ),
    actors: new Map([...actors].sort(([a], [b]) => (a < b ? -1 : 1))),
    time: track((script.time ?? []).map((k): [number, string, Ease] => [k.t, k.time, 'step'])),
    grade: track((script.grade ?? []).map((k): [number, string, Ease] => [k.t, k.grade, 'step'])),
  }
}

export const cameraAt = (s: Sequence, t: number): CameraPose => sample(s.camera, t, mixPose) as CameraPose

export const fadeAt = (s: Sequence, t: number): number => sample(s.fade, t, mixNumber) ?? 0

/** A piece the script keys is overridden from its first key on; before that it is as the builder put it. */
function fromFirstKey<V>(tracks: ReadonlyMap<string, Track<V>>, t: number, mix: Mix<V>): Record<string, V> {
  const out: Record<string, V> = {}
  for (const [name, keys] of tracks) {
    if (t < (keys[0] as { t: number }).t) continue
    out[name] = sample(keys, t, mix) as V
  }
  return out
}
export const lampsAt = (s: Sequence, t: number): Record<string, { level: number }> =>
  Object.fromEntries(
    Object.entries(fromFirstKey(s.lamps, t, mixNumber)).map(([lamp, level]) => [lamp, { level }]),
  )
export const doorsAt = (s: Sequence, t: number): Record<string, number> => fromFirstKey(s.doors, t, mixNumber)
export const propsAt = (s: Sequence, t: number): Record<string, PropPose> => fromFirstKey(s.props, t, mixProp)

/** The name a held track gives at `t`: the latest key at or before it, or `''` before the first. */
export const nameAt = (keys: Track<string>, t: number): string =>
  t < (keys[0]?.t ?? Number.POSITIVE_INFINITY) ? '' : (sample(keys, t, (a) => a) ?? '')

/** A deterministic tremble: three incommensurate sines per axis. */
export const tremble = (t: number, axis: number): number =>
  (Math.sin(t * 47 + axis * 1.7) +
    Math.sin(t * 29.3 + axis * 4.1) * 0.6 +
    Math.sin(t * 71.9 + axis * 2.3) * 0.3) /
  1.9

/** How hard the camera shakes at `t`: the strongest window, dying out by its end. */
export function shakeAt(s: PlacedScript, t: number): number {
  let amp = 0
  for (const [from, to, m] of s.shake ?? [])
    if (t >= from && t < to) amp = Math.max(amp, m * (1 - (t - from) / (to - from)))
  return amp
}

/** One actor at `t`. `keys` are the actor's, in time order. */
export function actorAt(keys: readonly EasedActorKey[], t: number): ActorFrame {
  // An actor has at least one key, so there is always a place.
  const place = bracket(keys, t) as { a: EasedActorKey; b: EasedActorKey; u: number }
  // A key that cuts is not moved towards: until its time the actor is just as the key before it left it.
  const { a, u } = place
  const b = place.b.ease === 'step' ? a : place.b
  const frame: ActorFrame = {
    x: mixNumber(a.x, b.x, u),
    z: mixNumber(a.z, b.z, u),
    alpha: mixNumber(a.alpha ?? 1, b.alpha ?? 1, u),
    // Facing switches half way along the move.
    facing: u < 0.5 ? (a.facing ?? 0) : (b.facing ?? a.facing ?? 0),
    moving: (a.moving === true || b.moving === true) && a !== b && u > 0 && u < 1,
  }
  if (a.y !== undefined || b.y !== undefined) frame.y = mixNumber(a.y ?? 0, b.y ?? 0, u)
  const shiver = mixNumber(a.shiver ?? 0, b.shiver ?? 0, u)
  if (shiver !== 0) {
    const d = tremble(t, 0) * shiver
    frame.x += Math.cos(frame.facing) * d
    frame.z -= Math.sin(frame.facing) * d
  }
  // The pose of the last key at or before t (keys hold until the next one), timed from the first key of that run.
  let i = 0
  while (i < keys.length - 1 && (keys[i + 1] as EasedActorKey).t <= t) i++
  const at = keys[i] as EasedActorKey
  const pose = at.t <= t ? at.pose : undefined
  for (let j = i; j >= 0 && (keys[j] as EasedActorKey).t <= t; j--) {
    const key = keys[j] as EasedActorKey
    if (key.density !== undefined && frame.density === undefined) frame.density = key.density
    if (key.face !== undefined && frame.face === undefined) frame.face = key.face
    if (frame.density !== undefined && frame.face !== undefined) break
  }
  if (pose !== undefined && !frame.moving) {
    let start = i
    while (start > 0 && (keys[start - 1] as EasedActorKey).pose === pose) start--
    frame.pose = pose
    frame.poseTime = t - (keys[start] as EasedActorKey).t
    if (at.frame !== undefined) frame.poseFrame = at.frame
  }
  return frame
}
