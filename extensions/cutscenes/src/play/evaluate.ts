// A script at time t (M6 spec §4.8), from the adventure source's `evaluate`: the camera, each actor, the caption, the lamps,
// the fade and the props' states. Pure and deterministic (the shake and the shiver are fixed sines), so a preview, the lint
// and a replay see the same frame. Presentation calls it at `(tick − start) / rate + alpha`; the sim never does.

import type { PlacedActorKey, PlacedScript } from '../sim/anchors'
import type { Caption, Ease, V3 } from '../sim/cutscene.schema'

/** The play lens, 50 mm, which a camera key with no lens keeps. */
export const CUTSCENE_LENS = 50
/** Vertical field of view, in degrees, of a focal length in mm on a 24 mm frame. */
export const fovOf = (lens: number): number => (2 * Math.atan(12 / lens) * 180) / Math.PI

const smooth = (t: number): number => t * t * (3 - 2 * t)
const EASES: Record<Ease, (t: number) => number> = {
  smooth,
  in: (t) => t * t,
  out: (t) => t * (2 - t),
  linear: (t) => t,
}
const mix = (a: number, b: number, k: number): number => a + (b - a) * k

/** The keys either side of `t`, and how far along (eased by the later key's ease). Keys are in time order. */
function between<K extends { t: number; cut?: boolean | undefined; ease?: Ease | undefined }>(
  keys: readonly K[],
  t: number,
): [K, K, number] {
  let i = 0
  while (i < keys.length - 1 && (keys[i + 1] as K).t <= t) i++
  const a = keys[i] as K
  const b = keys[Math.min(i + 1, keys.length - 1)] as K
  if (a === b || b.cut === true || b.t <= a.t) return [a, a, 0]
  return [a, b, EASES[b.ease ?? 'smooth'](Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))))]
}

/** A deterministic tremble: three incommensurate sines per axis. */
const tremble = (t: number, axis: number): number =>
  (Math.sin(t * 47 + axis * 1.7) +
    Math.sin(t * 29.3 + axis * 4.1) * 0.6 +
    Math.sin(t * 71.9 + axis * 2.3) * 0.3) /
  1.9

/**
 * `pose` and `poseTime`: the pose being played and the seconds since its run of keys began, so its frames start at its
 * first. `poseFrame`: the held frame, when the key names one.
 */
export interface ActorFrame {
  x: number
  z: number
  alpha: number
  facing: number
  moving: boolean
  pose?: string
  poseTime?: number
  poseFrame?: number
  y?: number
  density?: number
  face?: string
}
export interface CutsceneFrame {
  /** `fov`: the vertical field of view in degrees. */
  camera: { pos: V3; look: V3; fov: number }
  /** Each actor with a key, by `who`. */
  actors: Record<string, ActorFrame>
  caption: Caption | null
  flicker: boolean
  /** 0 clear, 1 black. */
  fade: number
  done: boolean
  /** The prop states shown so far (the script's `states` keys at or before t). */
  states: string[]
  /** How long each of `states` has held (s). */
  held: Record<string, number>
  /** Lamp level overrides from the script's `light` keys, eased between keys; a lamp is overridden from its first key on. */
  light: Record<string, number> | null
}

function actor(keys: readonly PlacedActorKey[], t: number): ActorFrame {
  const [a, b, k] = between(keys, t)
  const frame: ActorFrame = {
    x: mix(a.x, b.x, k),
    z: mix(a.z, b.z, k),
    alpha: mix(a.alpha ?? 1, b.alpha ?? 1, k),
    facing: k < 0.5 ? (a.facing ?? 0) : (b.facing ?? a.facing ?? 0),
    moving: (((a.moving === true || b.moving === true) && a !== b && k > 0 && k < 1) as boolean) || false,
  }
  if (a.y !== undefined || b.y !== undefined) frame.y = mix(a.y ?? 0, b.y ?? 0, k)
  const shiver = mix(a.shiver ?? 0, b.shiver ?? 0, k)
  if (shiver !== 0) {
    const d = tremble(t, 0) * shiver
    frame.x += Math.cos(frame.facing) * d
    frame.z -= Math.sin(frame.facing) * d
  }
  // The pose of the last key at or before t (keys hold until the next one), timed from the first key of that run.
  let i = 0
  while (i < keys.length - 1 && (keys[i + 1] as PlacedActorKey).t <= t) i++
  const at = keys[i] as PlacedActorKey
  const pose = at.t <= t ? at.pose : undefined
  for (let j = i; j >= 0 && (keys[j] as PlacedActorKey).t <= t; j--) {
    const key = keys[j] as PlacedActorKey
    if (key.density !== undefined && frame.density === undefined) frame.density = key.density
    if (key.face !== undefined && frame.face === undefined) frame.face = key.face
    if (frame.density !== undefined && frame.face !== undefined) break
  }
  if (pose !== undefined && !frame.moving) {
    let start = i
    while (start > 0 && (keys[start - 1] as PlacedActorKey).pose === pose) start--
    frame.pose = pose
    frame.poseTime = t - (keys[start] as PlacedActorKey).t
    if (at.frame !== undefined) frame.poseFrame = at.frame
  }
  return frame
}

function lights(s: PlacedScript, t: number): Record<string, number> | null {
  if (s.light === undefined || s.light.length === 0) return null
  const out: Record<string, number> = {}
  for (const lamp of [...new Set(s.light.map((k) => k.lamp))].sort()) {
    const list = s.light.filter((k) => k.lamp === lamp).sort((a, b) => a.t - b.t)
    if (t < (list[0] as { t: number }).t) continue
    const [a, b, k] = between(list, t)
    out[lamp] = mix(a.level, b.level, k)
  }
  return Object.keys(out).length > 0 ? out : null
}

function shakeAt(s: PlacedScript, t: number): number {
  let amp = 0
  for (const [from, to, m] of s.shake ?? [])
    if (t >= from && t < to) amp = Math.max(amp, m * (1 - (t - from) / (to - from)))
  return amp
}

export function evaluate(s: PlacedScript, t: number): CutsceneFrame {
  const [a, b, k] = between(s.camera, t)
  const base = s.lens ?? CUTSCENE_LENS
  const lens = mix(a.lens ?? base, b.lens ?? base, k)
  const amp = shakeAt(s, t)
  const fade =
    s.fade !== undefined && s.fade.length > 0
      ? (() => {
          const [fa, fb, fk] = between(s.fade, t)
          return mix(fa.value, fb.value, fk)
        })()
      : 0
  const reached = (s.states ?? []).filter((x) => t >= x.t)
  const whos = [...new Set((s.actor ?? []).map((x) => x.who))].sort()
  return {
    camera: {
      pos: [0, 1, 2].map(
        (i) => mix(a.pos[i] as number, b.pos[i] as number, k) + tremble(t, i) * amp,
      ) as unknown as V3,
      look: [0, 1, 2].map(
        (i) => mix(a.look[i] as number, b.look[i] as number, k) + tremble(t, i + 3) * amp,
      ) as unknown as V3,
      fov: fovOf(lens),
    },
    actors: Object.fromEntries(
      whos.map((who) => [
        who,
        actor(
          (s.actor ?? []).filter((x) => x.who === who),
          t,
        ),
      ]),
    ),
    caption: (s.caption ?? []).find((c) => t >= c.t && t < c.until) ?? null,
    flicker: (s.flicker ?? []).some(([from, to]) => t >= from && t < to),
    fade,
    done: t >= s.duration,
    light: lights(s, t),
    states: reached.map((x) => x.state),
    held: Object.fromEntries(reached.map((x) => [x.state, t - x.t])),
  }
}
