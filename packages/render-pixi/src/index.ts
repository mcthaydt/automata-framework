// @mcthaydt/automata-render-pixi: core 2D renderer for AutomataFramework

export const VERSION = '0.0.1'

export {
  canvasResolutionFor,
  MAX_RESOLUTION,
} from './letterbox/canvas-resolution.js'

export {
  DEFAULT_BAR_COLOR,
  DEFAULT_BAR_FRACTION,
  DEFAULT_FIELD_COLOR,
  LetterboxFrame,
  type LetterboxGeometry,
  type LetterboxOptions,
  PORTRAIT_FIELD_TOP,
  portraitFieldHeight,
} from './letterbox/letterbox.js'
