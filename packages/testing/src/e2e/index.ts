// Browser-journey helpers (M4 spec §4.14): the fake pad, touch, and the input × form-factor matrix. The only entry
// of this package that imports `@playwright/test`.
export {
  type Direction,
  FakePad,
  type FakePadOptions,
  PAD_BUTTONS,
  type PadButton,
  type PadMode,
} from './fake-pad'
export {
  type Engine,
  INPUT_MATRIX,
  type InputDevice,
  type MatrixCell,
  type MatrixFormFactor,
  type MatrixHost,
} from './input-matrix'
export { flick, hold, type Point, swipe, tap } from './touch'
