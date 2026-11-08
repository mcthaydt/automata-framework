// The JSON engine lives in the kit's content documents (EDS.1a); this entry still offers it to its consumers.

export * from '@automata/3d/level'
export {
  formatJsonNumber,
  formatJsonScalar,
  indentAt,
  insertElement,
  insertMember,
  type JsonKind,
  type JsonLiteral,
  type JsonNode,
  type JsonPath,
  type JsonScalar,
  JsonScanError,
  JsonShapeError,
  type JsonValue,
  JsonWriteError,
  type Layout,
  lineStart,
  type MemberPlacement,
  PACK_WIDTH,
  type PatchRefusalReason,
  type PatchResult,
  type PatchRules,
  patchJson,
  pathKey,
  readLayout,
  removeElement,
  removeMember,
  replaceValue,
  roundJsonNumber,
  type Scan,
  type Span,
  sameLine,
  scan,
  setMember,
} from '@automata/editor/kit/documents'
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
  createEditorApp,
  type EditorApp,
  type EditorAppOptions,
  type OpenOutcome,
} from './app/editor-app'
export type { ImportOutcome, PickedFile, Skipped, SkipReason } from './app/import-files'
export {
  createMergeTool,
  type MergeEffect,
  type MergeTarget,
  type MergeTool,
  type MergeToolView,
} from './app/merge-tool-controller'
export type { OpenLevel } from './app/open-level'
export type {
  DocumentSaveOutcome,
  ExportOutcome,
  PatchedDocument,
  PatchRefused,
  RestoreOutcome,
} from './app/patched-document'
export {
  createPlanController,
  type PlanController,
  type PlanPointer,
  type PlanView,
} from './app/plan-controller'
export type { ProjectEntry } from './app/project-list'
export { MAX_FILE_BYTES } from './app/read-level'
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
export * from './checks/generic-checks'
export { materialProblems } from './checks/materials'
export * from './checks/wall-locator'
export * from './entities/thing-def.schema'
export * from './entities/things'
export * from './geometry/loops'
// The six sector queries the level entry also exports (crossing, insideSector, opening, polygonArea, segmentDistance,
// walkBlocker) come from the entry above; the rest of the editor's sector model is named here.
export {
  type Collider,
  type Edge,
  edges,
  floorAt,
  isPortal,
  type Piece,
  type PortalEdge,
  pieces,
  type Resolved,
  type ResolvedMap,
  resolveMap,
  resolveSectors,
  type Sector,
  sectorAt,
} from './geometry/sectors'
export { type Triangle, type Triangulation, triangulate } from './geometry/triangulate'
export { type MoveCornerArgs, moveCorner, moveSector } from './model/corner-edits'
export {
  addDefinition,
  removeDefinition,
  renameDefinition,
  type SetDefinitionFieldArgs,
  setDefinitionField,
} from './model/definition-edits'
export { type Edit, type EditResult, ok, refuse } from './model/edit'
export { type EditCommandOptions, registerEditCommands } from './model/edit-commands'
export {
  createLevelEditor,
  type EditSession,
  type LevelEditor,
  type LevelEditorOptions,
} from './model/level-editor'
export type { LevelState } from './model/level-state'
export { addLink, removeLink } from './model/link-edits'
export {
  type ApplyMaterialArgs,
  applyMaterial,
  type MaterialScope,
  type MaterialTarget,
  materialOf,
} from './model/material-edits'
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
  thingLayer,
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
export * from './profile/af-sector/af-checks'
export * from './profile/af-sector/af-codec'
export * from './profile/af-sector/af-entities'
export {
  addMaterial,
  type MaterialArgs,
  removeMaterial,
  renameMaterial,
  setMaterial,
} from './profile/af-sector/af-material-edits'
export { type NewLevelResult, newAfSectorLevel } from './profile/af-sector/af-template'
export * from './profile/af-sector/build'
export * from './profile/af-sector-profile'
export type { DefinitionAccess, InstanceRename } from './profile/definition-access'
export * from './profile/file-codec'
export { type LevelHints, WALK_EYE_HEIGHT, WALK_FOV } from './profile/level-hints'
export {
  type Geometry,
  GeometryError,
  type GeometryLayer,
  type LevelProfile,
} from './profile/level-profile'
export type { Material, MaterialList } from './profile/materials'
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
export type { ThingLink, ThingLinks } from './profile/thing-links'
export type { LinkPlace } from './things/link-mode'
export {
  createThingsTool,
  type PaletteEntry,
  type Rectangle,
  type ThingPlace,
  type ThingsTool,
  type ThingsToolOptions,
  type ThingsToolView,
} from './things/things-tool-controller'
export {
  createMaterialPicker,
  type MaterialCategory,
  type MaterialPicker,
  type MaterialPickerOptions,
  type MaterialPickerView,
} from './view/materials/material-picker'
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
export { isThingLayerOff, pickThing, type ThingHit } from './view/plan/thing-pick'
export { type SelectionOf, selectionOf } from './view/selection-of'
export {
  createWalkController,
  type Stick,
  type WalkAim,
  type WalkController,
  type WalkMode,
  type WalkView,
} from './view/walk/walk-controller'
