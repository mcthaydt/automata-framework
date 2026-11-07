// @automata/3d: AF's 3D renderer on @pixi/3d (M3 spec §4.1). Private while D-1 stands: the
// beta's terms allow no public deployment, so `ship prepare` refuses a public build that contains it (X-b).
// Import `@automata/3d/no-eval` first, before anything else. The view's schema, the lens and the
// heading maths are the pure `./camera-view` entry; the heading's sim plugin is the `./sim` entry.

export {
  acceptsRenderer,
  createPixi3dRenderer,
  type Pixi3dOptions,
  type Pixi3dRenderer,
  type RendererKind,
} from '../app/create-renderer.ts'
export { render3dExtension } from '../app/render3d.extension.ts'
export {
  type AngledCameraOptions,
  angledCamera,
  type CameraPose,
  type CameraRig,
  HEADING_EASE_SECONDS,
  VIEW_EASE_SECONDS,
} from '../features/camera/angled-camera.ts'
export { type Pixi3dCameraOptions, PLAYER_HEIGHT } from '../features/camera/camera-driver.ts'
export { LOCK_SHARE, type Vec3 } from '../features/camera/camera-pose.ts'
export { cameraViewContent } from '../features/camera/camera-view.content.ts'
export { type FramingInput, type FramingMiss, framingMisses } from '../features/camera/occluders/framing.ts'
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
} from '../features/camera/occluders/occluder-pass.ts'
export {
  type Box3,
  FIGURE_REACH,
  lineCrossesWall,
  type PlanPoint,
  segmentHitsBox,
  TALL_PROP_METRES,
  type WallSpan,
  wallFacesAway,
} from '../features/camera/occluders/occluder-rule.ts'
export {
  type Occluders,
  type PropOptions,
  TRIM_HEIGHT,
  WALL_THICKNESS,
  type WallOptions,
} from '../features/camera/occluders/occluders.ts'
export {
  FIGURE_BUILD_BUDGET_MS,
  type FigureViewOptions,
  type FigureViewState,
  figure,
} from '../features/figures/view/figure-view.ts'
export { type BakeOptions, createSceneLight, type SceneLight } from '../shared/render/light/scene-light.ts'
export { sceneLightingContent } from '../shared/render/light/scene-lighting.content.ts'
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
} from '../shared/render/light/scene-lighting.schema.ts'
export { characterTint, type LampLevels } from '../shared/render/light/vertex-light.ts'
export {
  type DecodeTexture,
  type LoadedModel,
  loadModels,
  type ModelLibrary,
  type ModelStore,
} from '../shared/render/model/load-models.ts'
export { modelGeometry } from '../shared/render/model/model-geometry.ts'
export { type ModelMesh, parseGlb, parsePack } from '../shared/render/model/parse-glb.ts'
export { type BoxMaterial, type BoxSize, box } from '../shared/render/views/box-view.ts'
export { type MeshViewOptions, mesh } from '../shared/render/views/mesh-view.ts'
export { interpolatePose3d, type Pose3d, placeView3d } from '../shared/render/views/pose-3d.ts'
export type { EntityView3d, EntityViewResolver3d, View3dFactory } from '../shared/render/views/view-3d.ts'
