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
} from '../app/ask-controller'
export {
  type ChecksPanel,
  type ChecksPanelOptions,
  type ChecksPanelView,
  createChecksPanel,
  type LocateResult,
  type Scheduler,
} from '../features/levels-3d/checks/checks-panel-controller'
export {
  createEditorApp,
  type EditorApp,
  type EditorAppOptions,
  type OpenOutcome,
} from '../features/levels-3d/document/editor-app'
export type {
  ImportOutcome,
  PickedFile,
  Skipped,
  SkipReason,
} from '../features/levels-3d/document/import-files'
export type { OpenLevel } from '../features/levels-3d/document/open-level'
export type {
  DocumentSaveOutcome,
  ExportOutcome,
  PatchedDocument,
  PatchRefused,
  RestoreOutcome,
} from '../features/levels-3d/document/patched-document'
export { MAX_FILE_BYTES } from '../features/levels-3d/document/read-level'
export type { ProjectEntry } from '../features/levels-3d/home/project-list'
export {
  createMaterialPicker,
  type MaterialCategory,
  type MaterialPicker,
  type MaterialPickerOptions,
  type MaterialPickerView,
} from '../features/levels-3d/inspector/material-picker'
export {
  createMergeTool,
  type MergeEffect,
  type MergeTarget,
  type MergeTool,
  type MergeToolView,
} from '../features/levels-3d/plan/merge-tool-controller'
export {
  createPlanController,
  type PlanController,
  type PlanPointer,
  type PlanView,
} from '../features/levels-3d/plan/plan-controller'
export {
  type CornerHit,
  PICK_RADIUS,
  type PickOptions,
  type PlanHit,
  pickCorner,
  pickPlan,
  type WallHit,
} from '../features/levels-3d/plan/plan-pick'
export {
  type PlanFill,
  type PlanScene,
  type PlanSceneOptions,
  type PlanWall,
  planScene,
  type WallKind,
} from '../features/levels-3d/plan/plan-scene'
export {
  type SnapKind,
  type SnapOptions,
  type SnapResult,
  snapPlan,
} from '../features/levels-3d/plan/plan-snap'
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
} from '../features/levels-3d/plan/plan-viewport'
export {
  createSectorTool,
  type DrawEdge,
  type SectorShape,
  type SectorTool,
  type SectorToolOptions,
  type SectorToolView,
} from '../features/levels-3d/plan/sector-tool-controller'
export {
  createSplitTool,
  type SplitEffect,
  type SplitTarget,
  type SplitTool,
  type SplitToolOptions,
  type SplitToolView,
} from '../features/levels-3d/plan/split-tool-controller'
export { isThingLayerOff, pickThing, type ThingHit } from '../features/levels-3d/plan/thing-pick'
export {
  createVertexTool,
  type VertexEffect,
  type VertexTarget,
  type VertexTool,
  type VertexToolView,
} from '../features/levels-3d/plan/vertex-tool-controller'
export type { CornerPlace, OutlinePlace, WallPlace } from '../features/levels-3d/plan/wall-place'
export {
  createWallTool,
  type WallEffect,
  type WallTarget,
  type WallTool,
  type WallToolKind,
  type WallToolOptions,
  type WallToolView,
} from '../features/levels-3d/plan/wall-tool-controller'
export type { LinkPlace } from '../features/levels-3d/things/link-mode'
export {
  createThingsTool,
  type PaletteEntry,
  type Rectangle,
  type ThingPlace,
  type ThingsTool,
  type ThingsToolOptions,
  type ThingsToolView,
} from '../features/levels-3d/things/things-tool-controller'
export {
  followCamera,
  type RoomView,
  roomView,
} from '../features/levels-3d/walk/follow-camera'
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
} from '../features/levels-3d/walk/heading'
export {
  createWalkController,
  type Stick,
  type WalkAim,
  type WalkController,
  type WalkMode,
  type WalkView,
} from '../features/levels-3d/walk/walk-controller'
export * from '../shared/checks/check'
export * from '../shared/checks/entities'
export * from '../shared/checks/entity-refs'
export * from '../shared/checks/generic-checks'
export { materialProblems } from '../shared/checks/materials'
export * from '../shared/checks/wall-locator'
export { type MoveCornerArgs, moveCorner, moveSector } from '../shared/edit/corner-edits'
export {
  addDefinition,
  removeDefinition,
  renameDefinition,
  type SetDefinitionFieldArgs,
  setDefinitionField,
} from '../shared/edit/definition-edits'
export { type Edit, type EditResult, ok, refuse } from '../shared/edit/edit'
export { type EditCommandOptions, registerEditCommands } from '../shared/edit/edit-commands'
export {
  createLevelEditor,
  type EditSession,
  type LevelEditor,
  type LevelEditorOptions,
} from '../shared/edit/level-editor'
export type { LevelState } from '../shared/edit/level-state'
export { addLink, removeLink } from '../shared/edit/link-edits'
export {
  type ApplyMaterialArgs,
  applyMaterial,
  type MaterialScope,
  type MaterialTarget,
  materialOf,
} from '../shared/edit/material-edits'
export { type MergeSectorsArgs, mergeSectors } from '../shared/edit/merge-edits'
export { type PortalOffer, portalOffers, type WallPortal, wallPortal } from '../shared/edit/portal-offers'
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
} from '../shared/edit/sector-edits'
export { type SelectionOf, selectionOf } from '../shared/edit/selection-of'
export { parseSelection, type SelectionRef } from '../shared/edit/selection-ref'
export { type SplitSectorArgs, splitSector } from '../shared/edit/split-edits'
export {
  type AddThingArgs,
  addThing,
  type MoveThingArgs,
  moveThing,
  removeThing,
  type SetThingFieldArgs,
  setThingField,
} from '../shared/edit/thing-edits'
export {
  type InsertCornerArgs,
  insertCorner,
  type RemoveCornerArgs,
  removeCorner,
} from '../shared/edit/vertex-edits'
export {
  createViewStore,
  initialView,
  thingLayer,
  type ViewMode,
  type ViewState,
  type ViewStore,
} from '../shared/edit/view-store'
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
} from '../shared/edit/wall-edits'
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
} from '../shared/geometry/camera-3d'
export * from '../shared/geometry/loops'
export {
  facesEye,
  type MeshHit,
  pickMesh,
  surfaceVisibility,
  type Visibility,
  visibleSurfaces,
} from '../shared/geometry/mesh-pick'
export {
  type Box3,
  buildSectorMesh,
  EMPTY_BOUNDS,
  faceShade,
  type SectorMesh,
  type Surface,
  type SurfaceRole,
  type Vec3,
} from '../shared/geometry/sector-mesh'
export * from '../shared/geometry/sectors'
export * from '../shared/level-session/af-sector/af-checks'
export * from '../shared/level-session/af-sector/af-codec'
export * from '../shared/level-session/af-sector/af-entities'
export {
  addMaterial,
  type MaterialArgs,
  removeMaterial,
  renameMaterial,
  setMaterial,
} from '../shared/level-session/af-sector/af-material-edits'
export { type NewLevelResult, newAfSectorLevel } from '../shared/level-session/af-sector/af-template'
export * from '../shared/level-session/af-sector/build'
export * from '../shared/level-session/af-sector-profile'
export type { DefinitionAccess, InstanceRename } from '../shared/level-session/definition-access'
export * from '../shared/level-session/file-codec'
export { type LevelHints, WALK_EYE_HEIGHT, WALK_FOV } from '../shared/level-session/level-hints'
export {
  type Geometry,
  GeometryError,
  type GeometryLayer,
  type LevelProfile,
} from '../shared/level-session/level-profile'
export type { Material, MaterialList } from '../shared/level-session/materials'
export * from '../shared/level-session/registry'
export {
  type EditCorner,
  type EditSector,
  type EditWall,
  inheritedMaterials,
  portalReferences,
  type SectorAccess,
  SectorAccessError,
  type SectorDraft,
} from '../shared/level-session/sector-access'
export { type ThingAccess, ThingAccessError } from '../shared/level-session/thing-access'
export type { ThingLink, ThingLinks } from '../shared/level-session/thing-links'
export * from '../shared/things/thing-def.schema'
export * from '../shared/things/things'
