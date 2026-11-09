// @automataframework/automata-render-pixi3d/sim: the camera's heading as sim state (M3 spec §4.2), sim-safe and checked by
// `pnpm boundaries`. A game's sim imports this entry (declared in package.json `automata.simEntries`), never the
// renderer's.
export { CameraHeading } from './camera-heading.component.js'
export { cameraHeadingPlugin } from './camera-heading.plugin.js'
export { CameraTurn } from './camera-turn.command.js'
export { cameraTurnSystem } from './camera-turn.system.js'
export {
  CAMERA_DEFAULTS,
  CAMERA_RANGES,
  type CameraView,
  type CameraViewFields,
  type CameraViewInput,
  cameraView,
  cameraViewSchema,
} from './camera-view.schema.js'
export {
  clampTurn,
  degToHeading,
  headingDegrees,
  MAX_CAMERA_TURN,
  TURN_UNITS,
  turnHeading,
  wrapHeading,
} from './heading.js'
export { type Direction, mapStick, Q16, STICK_MAX, type Stick } from './stick-mapper.js'
export { enterView, type HeadingState, moveDirection, START, turnCamera } from './view-latch.js'
