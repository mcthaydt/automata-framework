// @mcthaydt/automata-render-pixi: core 2D renderer for AutomataFramework

export const VERSION = '0.0.1'

export {
  type Camera2d,
  type Camera2dOptions,
  type CameraRect,
  createCamera2d,
  SHAKE_DECAY,
  SHAKE_MAX_OFFSET,
} from './camera/camera-2d.js'
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
  createPostFilterSlot,
  type PostFilterSlot,
  type PostFilterTarget,
} from './filter/post-filter-slot.js'
export {
  canvasResolutionFor,
  MAX_RESOLUTION,
  RESOLUTION_CAPS,
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
