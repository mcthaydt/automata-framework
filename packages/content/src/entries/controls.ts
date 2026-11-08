// @automata/content/controls: a game's default controls as data (`content/controls.toml`) and the lists of what may
// be bound. Browser-safe: zod and plain values.
export {
  type ControlAction,
  type ControlsFile,
  controlsFileSchema,
  GESTURE_NAMES,
  type GestureName,
  RESERVED_KEYS,
  RESERVED_PAD_BUTTONS,
  STANDARD_PAD_BUTTON_MAX,
  STICK_DIRECTIONS,
  type StickDirection,
} from '../shared/controls/controls.schema.ts'
export { controlsKind } from '../shared/controls/controls-kind.ts'
