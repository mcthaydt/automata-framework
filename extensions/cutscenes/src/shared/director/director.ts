// The director plays a placed script: a state of the scene at any time `t`. The state comes from the keys alone, so
// a preview, the lint and a replay see the same frame; the one thing a director remembers is which cues it has started.
// Presentation calls it at `(tick − start) / rate + alpha`; the sim never does.

import type { PlacedScript } from '../sim/anchors'
import type { CueKey, V3 } from '../sim/cutscene.schema'
import type { SceneState } from './scene-state'
import {
  actorAt,
  cameraAt,
  doorsAt,
  fadeAt,
  fovOf,
  lampsAt,
  nameAt,
  propsAt,
  type Sequence,
  sequenceOf,
  shakeAt,
  tremble,
} from './sequence'

export type { ActorFrame, CameraFrame, SceneState } from './scene-state'
export { CUTSCENE_LENS, fovOf } from './sequence'

/** Starts the clip `clip` on the figure `who`, `at` seconds into the scene. */
export type StartClip = (who: string, clip: string, at: number) => void

export interface Director {
  /** The scene at `t` seconds. Starts every cue at or before `t` that has not started yet. */
  stateAt(t: number): SceneState
}

/**
 * Plays `script`, handing each cue to `startClip` as the scene passes its time, once. Jumping ahead starts every cue
 * on the way, in time order; winding back before a cue lets it start again when the scene passes it again.
 */
export function createDirector(script: PlacedScript, startClip: StartClip): Director {
  const sequence = sequenceOf(script)
  const cues: readonly CueKey[] = [...(script.cues ?? [])].sort((a, b) => a.at - b.at)
  let next = 0
  let last = Number.NEGATIVE_INFINITY

  function startCues(t: number): void {
    if (t < last) {
      // Wound back: the cues up to `t` count as started, the ones after it start again when passed.
      const ahead = cues.findIndex((c) => c.at > t)
      next = ahead === -1 ? cues.length : ahead
    }
    last = t
    for (; next < cues.length && (cues[next] as CueKey).at <= t; next++) {
      const cue = cues[next] as CueKey
      startClip(cue.who, cue.clip, cue.at)
    }
  }

  return {
    stateAt(t) {
      startCues(t)
      return stateOf(script, sequence, t)
    },
  }
}

function stateOf(script: PlacedScript, sequence: Sequence, t: number): SceneState {
  const pose = cameraAt(sequence, t)
  const amp = shakeAt(script, t)
  const shaken = (v: V3, axis: number): V3 => [
    (v[0] as number) + tremble(t, axis) * amp,
    (v[1] as number) + tremble(t, axis + 1) * amp,
    (v[2] as number) + tremble(t, axis + 2) * amp,
  ]
  const reached = (script.states ?? []).filter((x) => t >= x.t)
  return {
    camera: {
      pos: shaken(pose.pos, 0),
      look: shaken(pose.look, 3),
      fov: fovOf(pose.lens),
    },
    actors: Object.fromEntries([...sequence.actors].map(([who, keys]) => [who, actorAt(keys, t)])),
    caption: (script.caption ?? []).find((c) => t >= c.t && t < c.until) ?? null,
    flicker: (script.flicker ?? []).some(([from, to]) => t >= from && t < to),
    fade: fadeAt(sequence, t),
    done: t >= script.duration,
    states: reached.map((x) => x.state),
    held: Object.fromEntries(reached.map((x) => [x.state, t - x.t])),
    doors: doorsAt(sequence, t),
    lamps: lampsAt(sequence, t),
    props: propsAt(sequence, t),
    time: nameAt(sequence.time, t),
    grade: nameAt(sequence.grade, t),
  }
}
