// @mcthaydt/automata-render-pixi3d/camera-view: the pure entry (M3 spec §4.2, "one owner for camera-view", amended
// 2026-10-30). The view's schema, defaults and ranges, the lens and the heading maths, for the renderer and the 3D
// level editor. It imports no Pixi and no `@pixi/3d` (its test reads the module graph), so a tool may use it without
// the closed beta. The schema and the heading are the sim entry's own definitions, re-exported.
export { fovOf, LENS_MM } from './camera/fov.js'
export {
  CAMERA_DEFAULTS,
  CAMERA_RANGES,
  type CameraView,
  type CameraViewFields,
  type CameraViewInput,
  cameraView,
  cameraViewSchema,
} from './sim/camera-view.schema.js'
export {
  degToHeading,
  headingDegrees,
  MAX_CAMERA_TURN,
  TURN_UNITS,
  turnHeading,
  wrapHeading,
} from './sim/heading.js'
