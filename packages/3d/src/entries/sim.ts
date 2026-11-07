// @automata/3d/sim: the camera's heading as sim state (M3 spec §4.2), sim-safe and checked by
// `pnpm boundaries`. A game's sim imports this entry (declared in package.json `automata.simEntries`), never the
// renderer's.
export { CameraHeading } from '../features/camera/sim/camera-heading.component.ts'
export { cameraHeadingPlugin } from '../features/camera/sim/camera-heading.plugin.ts'
export { CameraTurn } from '../features/camera/sim/camera-turn.command.ts'
export { cameraTurnSystem } from '../features/camera/sim/camera-turn.system.ts'
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
  clampTurn,
  degToHeading,
  headingDegrees,
  MAX_CAMERA_TURN,
  TURN_UNITS,
  turnHeading,
  wrapHeading,
} from '../features/camera/sim/heading.ts'
export { type Direction, mapStick, Q16, STICK_MAX, type Stick } from '../features/camera/sim/stick-mapper.ts'
export {
  enterView,
  type HeadingState,
  moveDirection,
  START,
  turnCamera,
} from '../features/camera/sim/view-latch.ts'
