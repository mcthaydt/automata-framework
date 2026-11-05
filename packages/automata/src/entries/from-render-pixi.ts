// @mcthaydt/automata-render-pixi: core 2D renderer for AutomataFramework

export {
  type Camera2d,
  type Camera2dOptions,
  type CameraRect,
  createCamera2d,
} from '../features/render/camera/camera-2d.js'
export {
  type EntityView,
  RenderDeltaConsumer,
} from '../features/render/delta/render-delta-consumer.js'
export { filterPrograms } from '../features/render/filter/filter-programs.js'
export {
  type PostFilterDef,
  type PostFilterSpec,
  postFilter,
} from '../features/render/filter/post-filter.js'
export { createPostFilterSlot } from '../features/render/filter/post-filter-slot.js'
export {
  createPixiRenderer,
  type PixiRenderer,
  type PixiRendererOptions,
  type PixiStage,
  type PixiStageHooks,
} from '../features/render/renderer.js'
export { type RectViewOptions, rect } from '../features/render/views/rect-view.js'
export { type SpriteFrames, type SpriteViewOptions, sprite } from '../features/render/views/sprite-view.js'
export {
  lerp,
  lerpAngle,
  type Pose,
} from '../features/render/views/view-pose.js'
