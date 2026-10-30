export {
  type AcceptResult,
  type Ask,
  type AskGhost,
  type AskOptions,
  type AskView,
  createAsk,
} from './app/ask-controller'
export {
  type ChecksPanel,
  type ChecksPanelOptions,
  type ChecksPanelView,
  createChecksPanel,
  type LocateResult,
  type Scheduler,
} from './app/checks-panel-controller'
export {
  createMergeTool,
  type MergeEffect,
  type MergeTarget,
  type MergeTool,
  type MergeToolView,
} from './app/merge-tool-controller'
export {
  createPlanController,
  type PlanController,
  type PlanPointer,
  type PlanView,
} from './app/plan-controller'
export {
  createSectorTool,
  type DrawEdge,
  type SectorShape,
  type SectorTool,
  type SectorToolOptions,
  type SectorToolView,
} from './app/sector-tool-controller'
export {
  createSplitTool,
  type SplitEffect,
  type SplitTarget,
  type SplitTool,
  type SplitToolOptions,
  type SplitToolView,
} from './app/split-tool-controller'
export {
  createVertexTool,
  type VertexEffect,
  type VertexTarget,
  type VertexTool,
  type VertexToolView,
} from './app/vertex-tool-controller'
export type { CornerPlace, OutlinePlace, WallPlace } from './app/wall-place'
export {
  createWallTool,
  type WallEffect,
  type WallTarget,
  type WallTool,
  type WallToolKind,
  type WallToolOptions,
  type WallToolView,
} from './app/wall-tool-controller'
export * from './checks/check'
export * from './checks/entities'
export * from './checks/entity-refs'
export { type FacilityResults, facilityChecks } from './checks/facility/facility-checks'
export * from './checks/generic-checks'
export { DEFAULT_TONE, type LampKind, lampProblems } from './checks/last-light/lamps'
export * from './checks/last-light/last-light-checks'
export { type RoomOwners, type RoomPolicy, roomPolicyProblems } from './checks/last-light/room-policy'
export { materialProblems } from './checks/materials'
export * from './checks/wall-locator'
export * from './codec/layout'
export * from './codec/locate'
export { type PatchRefusalReason, type PatchResult, type PatchRules, patchJson } from './codec/patch'
export * from './codec/print'
export * from './codec/structure'
export * from './entities/thing-def.schema'
export * from './entities/things'
export * from './format/af-sector.schema'
export * from './format/blockout.schema'
export * from './format/expand'
export * from './format/facility.schema'
export * from './format/sector.schema'
export * from './geometry/loops'
export * from './geometry/nav'
export * from './geometry/sectors'
export { type Triangle, type Triangulation, triangulate } from './geometry/triangulate'
export { type MoveCornerArgs, moveCorner, moveSector } from './model/corner-edits'
export { type Edit, type EditResult, ok, refuse } from './model/edit'
export { type EditCommandOptions, registerEditCommands } from './model/edit-commands'
export {
  createFacilityEditor,
  type FacilityEdit,
  type FacilityEditor,
  type FacilityEditorOptions,
  type FacilitySession,
  type FacilityState,
} from './model/facility-editor'
export { type MoveWingArgs, moveWing, removeJoin, setJoin, setLock } from './model/facility-edits'
export { type FacilitySelectionRef, parseFacilitySelection } from './model/facility-selection'
export {
  createLevelEditor,
  type EditSession,
  type LevelEditor,
  type LevelEditorOptions,
} from './model/level-editor'
export type { LevelState } from './model/level-state'
export { type MergeSectorsArgs, mergeSectors } from './model/merge-edits'
export { type PortalOffer, portalOffers, type WallPortal, wallPortal } from './model/portal-offers'
export {
  type AddSectorArgs,
  addSector,
  type DuplicateSectorArgs,
  duplicateSector,
  removeSector,
  removeSectors,
  type SetHeightsArgs,
  type SetMaterialsArgs,
  setHeights,
  setLight,
  setMaterials,
  setView,
} from './model/sector-edits'
export { parseSelection, type SelectionRef } from './model/selection-ref'
export { type SplitSectorArgs, splitSector } from './model/split-edits'
export {
  type AddThingArgs,
  addThing,
  type MoveThingArgs,
  moveThing,
  removeThing,
  type SetThingFieldArgs,
  setThingField,
} from './model/thing-edits'
export {
  type InsertCornerArgs,
  insertCorner,
  type RemoveCornerArgs,
  removeCorner,
} from './model/vertex-edits'
export {
  createViewStore,
  initialView,
  type ViewMode,
  type ViewState,
  type ViewStore,
} from './model/view-store'
export {
  type DoorArgs,
  setDoor,
  setWallFlags,
  setWallKind,
  setWallMaterial,
  setWallOcclude,
  setWindow,
  type WallFlagsArgs,
  type WallKindArgs,
  type WallRef,
  type WindowArgs,
} from './model/wall-edits'
export type { AskProvider, ChangeSet, Generator, Proposal } from './ports/ports'
export * from './profile/af-sector/af-checks'
export * from './profile/af-sector/af-codec'
export * from './profile/af-sector/af-entities'
export * from './profile/af-sector/build'
export * from './profile/af-sector-profile'
export * from './profile/file-codec'
export * from './profile/last-light-codecs'
export * from './profile/last-light-entities'
export * from './profile/last-light-profile'
export {
  type Geometry,
  GeometryError,
  type GeometryLayer,
  type LevelProfile,
  type ProfileContext,
} from './profile/level-profile'
export * from './profile/registry'
export {
  type EditCorner,
  type EditSector,
  type EditWall,
  inheritedMaterials,
  portalReferences,
  type SectorAccess,
  SectorAccessError,
  type SectorDraft,
} from './profile/sector-access'
export { type ThingAccess, ThingAccessError } from './profile/thing-access'
export {
  type Camera3D,
  type FitOptions,
  fitOrbit,
  forward,
  HOME_YAW,
  ORBIT_FOV,
  type Orbit,
  orbitBy,
  orbitCamera,
  projectPoint,
  type Ray,
  rayThrough,
  type SpawnPoint,
  WALK_EYE_HEIGHT,
  WALK_FOV,
  type WalkOptions,
  type WalkStart,
  walkCamera,
  walkStart,
} from './view/mesh/camera-3d'
export {
  followCamera,
  type RoomView,
  roomView,
} from './view/mesh/follow-camera'
export {
  DEGREES_PER_PIXEL,
  dragTurn,
  type HeadingOptions,
  type HeadingView,
  headingSweep,
  headingToDeg,
  headingToYaw,
  headingView,
  type SweepOptions,
  type WallsSeen,
  wallsSeenFrom,
  yawToHeading,
} from './view/mesh/heading'
export {
  facesEye,
  type MeshHit,
  pickMesh,
  surfaceVisibility,
  type Visibility,
  visibleSurfaces,
} from './view/mesh/mesh-pick'
export {
  type Box3,
  buildSectorMesh,
  EMPTY_BOUNDS,
  faceShade,
  type SectorMesh,
  type Surface,
  type SurfaceRole,
  type Vec3,
} from './view/mesh/sector-mesh'
export {
  type CornerHit,
  PICK_RADIUS,
  type PickOptions,
  type PlanHit,
  pickCorner,
  pickPlan,
  type WallHit,
} from './view/plan/plan-pick'
export {
  type PlanFill,
  type PlanScene,
  type PlanSceneOptions,
  type PlanWall,
  planScene,
  type WallKind,
} from './view/plan/plan-scene'
export { type SnapKind, type SnapOptions, type SnapResult, snapPlan } from './view/plan/plan-snap'
export {
  cameraOf,
  fitPlan,
  type GridLine,
  type GridLines,
  gridLines,
  gridStep,
  levelBounds,
  PLAN_LIMITS,
  PLAN_PX_PER_M,
  planViewport,
  type SnapKeys,
  snapStep,
  snapValue,
  toScreen,
  toWorld,
} from './view/plan/plan-viewport'
export { type SelectionOf, selectionOf } from './view/selection-of'
