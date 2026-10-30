// @mcthaydt/automata-render-pixi3d: AF's 3D renderer on @pixi/3d (M3 spec §4.1). Private while D-1 stands: the
// beta's terms allow no public deployment, so `ship prepare` refuses a public build that contains it (X-b).
// Import `@mcthaydt/automata-render-pixi3d/no-eval` first, before anything else. The view's schema, the lens and the
// heading maths are the pure `./camera-view` entry; the heading's sim plugin is the `./sim` entry.

export {
  type AngledCameraOptions,
  angledCamera,
  type CameraPose,
  type CameraRig,
  HEADING_EASE_SECONDS,
  VIEW_EASE_SECONDS,
} from './camera/angled-camera.js'
export { type Pixi3dCameraOptions, PLAYER_HEIGHT } from './camera/camera-driver.js'
export { LOCK_SHARE, type Vec3 } from './camera/camera-pose.js'
export { cameraViewContent } from './camera/camera-view.content.js'
export {
  FIGURE_BUILD_BUDGET_MS,
  type FigureViewOptions,
  type FigureViewState,
  figure,
} from './figure/figure-view.js'
export { type BakeOptions, createSceneLight, type SceneLight } from './light/scene-light.js'
export { sceneLightingContent } from './light/scene-lighting.content.js'
export {
  type Lamp,
  lampSchema,
  type OccluderBox,
  type OccluderPlane,
  occluderBoxSchema,
  occluderPlaneSchema,
  type SceneFog,
  type SceneLighting,
  sceneFogSchema,
  sceneLightingSchema,
} from './light/scene-lighting.schema.js'
export { characterTint, type LampLevels } from './light/vertex-light.js'
export {
  type DecodeTexture,
  type LoadedModel,
  loadModels,
  type ModelLibrary,
  type ModelStore,
} from './model/load-models.js'
export { modelGeometry } from './model/model-geometry.js'
export { type ModelMesh, parseGlb, parsePack } from './model/parse-glb.js'
export { type FramingInput, type FramingMiss, framingMisses } from './occluders/framing.js'
export {
  FADED_OPACITY,
  HYSTERESIS_DEG,
  OCCLUDER_FADE_SECONDS,
  type OccluderFrame,
  type OccluderPass,
  type OccluderShown,
  occluderPass,
  type PropEntry,
  type WallEntry,
  type WallShown,
} from './occluders/occluder-pass.js'
export {
  type Box3,
  FIGURE_REACH,
  lineCrossesWall,
  type PlanPoint,
  segmentHitsBox,
  TALL_PROP_METRES,
  type WallSpan,
  wallFacesAway,
} from './occluders/occluder-rule.js'
export {
  type Occluders,
  type PropOptions,
  TRIM_HEIGHT,
  WALL_THICKNESS,
  type WallOptions,
} from './occluders/occluders.js'
export { render3dExtension } from './render3d.extension.js'
export {
  acceptsRenderer,
  createPixi3dRenderer,
  type Pixi3dOptions,
  type Pixi3dRenderer,
  type RendererKind,
} from './renderer/create-pixi3d-renderer.js'
export { type BoxMaterial, type BoxSize, box } from './views/box-view.js'
export { type MeshViewOptions, mesh } from './views/mesh-view.js'
export { interpolatePose3d, type Pose3d, placeView3d } from './views/pose-3d.js'
export type { EntityView3d, EntityViewResolver3d, View3dFactory } from './views/view-3d.js'
