// The core 2D renderer: cameras, views, draw shapes and filters.

export type { HudBox, HudLabel, HudTextStyle } from '../features/hud-text/hud-label.js'
export { HUD_TEXT_FLOOR, WORD_TEXT_FLOOR } from '../features/hud-text/hud-size.js'
export {
  createHudText,
  type HudSurface,
  type HudText,
  type PageSource,
} from '../features/hud-text/hud-text.js'
export type { PageId } from '../features/hud-text/pages.js'
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
  type LevelDraw,
  levelDrawList,
} from '../features/render/level-2d/level-draw-list.js'
export {
  type LevelScene,
  type LevelSceneHooks,
  type LevelSceneOptions,
  levelScene,
} from '../features/render/level-2d/level-scene.js'
export {
  createPixiRenderer,
  type PixiRenderer,
  type PixiRendererOptions,
  type PixiStage,
  type PixiStageHooks,
} from '../features/render/renderer.js'
export type { StageCharacters } from '../features/render/stage-characters.js'
export { type PictureViewOptions, pictureView } from '../features/render/views/picture-view.js'
export { type RectViewOptions, rect } from '../features/render/views/rect-view.js'
export { type SpriteFrames, type SpriteViewOptions, sprite } from '../features/render/views/sprite-view.js'
export {
  lerp,
  lerpAngle,
  type Pose,
} from '../features/render/views/view-pose.js'
export type { HudScale } from '../shared/draw/hud-scale.js'
