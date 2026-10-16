// @mcthaydt/automata-render-pixi: core 2D renderer for AutomataFramework

export const VERSION = '0.0.1'

export {
  type EntityView,
  type EntityViewFactory,
  type EntityViewResolver,
  RenderDeltaConsumer,
} from './delta/render-delta-consumer.js'
export {
  FILTER_VERTEX,
  type FilterProgramsResult,
  filterPrograms,
  WGSL_FILTER_HEADER,
} from './filter/filter-programs.js'
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
export {
  createPixiRenderer,
  type PixiRenderer,
  type PixiRendererOptions,
  type PixiStage,
  type PixiStageHooks,
  type RendererPreference,
} from './renderer.js'
export { type RectViewOptions, rect } from './views/rect-view.js'
export { type SpriteFrames, type SpriteViewOptions, sprite } from './views/sprite-view.js'
export {
  interpolatePose,
  lerp,
  lerpAngle,
  type Pose,
  poseComponent,
  type ViewAnchor,
} from './views/view-pose.js'
