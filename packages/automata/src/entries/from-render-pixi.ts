// @mcthaydt/automata-render-pixi: core 2D renderer for AutomataFramework

export {
  type Camera2d,
  type Camera2dOptions,
  type CameraRect,
  createCamera2d,
  SHAKE_DECAY,
  SHAKE_MAX_OFFSET,
} from '../features/render/camera/camera-2d.js'
export {
  type EntityView,
  type EntityViewFactory,
  type EntityViewResolver,
  RenderDeltaConsumer,
  type SceneNode,
  type SceneParent,
} from '../features/render/delta/render-delta-consumer.js'
export {
  FILTER_VERTEX,
  type FilterProgramsResult,
  filterPrograms,
  WGSL_FILTER_HEADER,
} from '../features/render/filter/filter-programs.js'
export {
  type PostFilterDef,
  type PostFilterSpec,
  postFilter,
} from '../features/render/filter/post-filter.js'
export {
  createPostFilterSlot,
  type PostFilterOptions,
  type PostFilterSlot,
  type PostFilterTarget,
} from '../features/render/filter/post-filter-slot.js'
export {
  canvasResolutionFor,
  MAX_RESOLUTION,
  RESOLUTION_CAPS,
} from '../features/render/letterbox/canvas-resolution.js'
export { CompositeTarget } from '../features/render/letterbox/composite-target.js'
export {
  DEFAULT_BAR_COLOR,
  DEFAULT_BAR_FRACTION,
  DEFAULT_FIELD_COLOR,
  LetterboxFrame,
  type LetterboxGeometry,
  type LetterboxOptions,
  PORTRAIT_FIELD_TOP,
  portraitFieldHeight,
} from '../features/render/letterbox/letterbox.js'
export { meetsTier } from '../features/render/quality/meets-tier.js'
export { type QualityBuild, rebuildOnQuality } from '../features/render/quality/rebuild-on-quality.js'
export {
  createPixiRenderer,
  type PixiRenderer,
  type PixiRendererOptions,
  type PixiStage,
  type PixiStageHooks,
  type RendererPreference,
} from '../features/render/renderer.js'
export { type RectViewOptions, rect } from '../features/render/views/rect-view.js'
export { type SpriteFrames, type SpriteViewOptions, sprite } from '../features/render/views/sprite-view.js'
export {
  interpolatePose,
  lerp,
  lerpAngle,
  type Pose,
  poseComponent,
  type ViewAnchor,
} from '../features/render/views/view-pose.js'
