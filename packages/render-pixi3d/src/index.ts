// @mcthaydt/automata-render-pixi3d: AF's 3D renderer on @pixi/3d (M3 spec §4.1). Private while D-1 stands: the
// beta's terms allow no public deployment, so `ship prepare` refuses a public build that contains it (X-b).
// Import `@mcthaydt/automata-render-pixi3d/no-eval` first, before anything else.

export { type BakeOptions, createSceneLight, type SceneLight } from './light/scene-light.js'
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
export { sceneLightingContent } from './light/scene-lighting-kind.js'
export { characterTint, type LampLevels } from './light/vertex-light.js'
export { type DecodeTexture, type LoadedModel, loadModels, type ModelLibrary } from './model/load-models.js'
export { modelGeometry } from './model/model-geometry.js'
export { type ModelMesh, parseGlb, parsePack } from './model/parse-glb.js'
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
