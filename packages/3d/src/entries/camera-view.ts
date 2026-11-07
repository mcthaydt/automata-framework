// @automata/3d/camera-view: the pure entry (M3 spec §4.2, "one owner for camera-view", amended
// 2026-10-30). The view's schema, defaults and ranges, the lens and the heading maths, for the renderer and the 3D
// level editor. It imports no Pixi and no `@pixi/3d` (its test reads the module graph), so a tool may use it without
// the closed beta. The schema and the heading are the sim entry's own definitions, re-exported; `occlude` (how the
// angled camera treats a wall or a prop, M3.4c) is the sector format's (M6-D17), re-exported the same way.

export { fovOf, LENS_MM } from '../features/camera/fov.ts'
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
  TURN_UNITS,
  turnHeading,
  wrapHeading,
} from '../features/camera/sim/heading.ts'
export { OCCLUDES, type Occlude, occludeSchema } from '../shared/level/occlude.ts'
