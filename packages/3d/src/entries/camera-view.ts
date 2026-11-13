// @automata/3d/camera-view: the pure entry ("one owner for camera-view", amended
// 2026-10-30). The view's schema, defaults and ranges, the lens and the heading maths, for the renderer and the 3D
// level editor. It imports no Pixi and no `@pixi/3d` (its test reads the module graph), so a tool may use it without
// the closed beta. The schema and the heading are the sim entry's own definitions, re-exported; `occlude` (how the
// angled camera treats a wall or a prop) is the sector format's, re-exported the same way.

export { fovOf, LENS_MM } from '../features/camera/fov.ts'
export {
  clampPeek,
  FOLLOW_DEAD_ZONE,
  PEEK_REACH,
  PLAY_FRAMING,
  SHAKE_PX,
  type Shot,
  shakeOffset,
  stepFraming,
  zoneShot,
} from '../features/camera/play-camera.ts'
export {
  bestLookHeight,
  type FitField,
  type FitSprite,
  type FloorRect,
  type FocusFit,
  fitFocus,
  followLook,
  insideFrame,
  reachOf,
  type SpriteBox,
  spriteBoxAt,
} from '../features/camera/play-fit.ts'
export {
  CAMERA_DEFAULTS,
  CAMERA_RANGES,
  type CameraView,
  type CameraViewFields,
  type CameraViewInput,
  cameraView,
  cameraViewSchema,
} from '../features/camera/sim/camera-view.schema.ts'
export {
  degToHeading,
  headingDegrees,
  MAX_CAMERA_TURN,
  stepHeading,
  TURN_UNITS,
  turnDirection,
  turnHeading,
  wrapHeading,
} from '../features/camera/sim/heading.ts'
export { type FloorPoint, viewAt } from '../features/camera/sim/view-zone.ts'
export { OCCLUDES, type Occlude, occludeSchema } from '../shared/level/occlude.ts'
