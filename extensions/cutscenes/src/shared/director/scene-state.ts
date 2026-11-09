// What the director hands a renderer for one moment of a scene: the camera, each actor, the caption, the fade, and the
// states of the world's pieces (`PieceStates`, which the renderer's `updatePieces` already reads).

import type { PieceStates } from '@automata/3d/level'
import type { Caption, V3 } from '../sim/cutscene.schema'

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

/** `fov`: the vertical field of view in degrees. */
export interface CameraFrame {
  pos: V3
  look: V3
  fov: number
}

/**
 * The scene at one time. `doors`, `lamps` and `props` are `PieceStates`: a piece appears from its first key on, and one
 * with no entry is as the builder put it.
 */
export interface SceneState extends PieceStates {
  camera: CameraFrame
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
  /** The time of day the scene is lit by, or `''` before the script names one. */
  time: string
  /** The mood grade, or `''` before the script names one. */
  grade: string
}
