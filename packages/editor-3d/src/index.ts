export * from './checks/check'
export * from './checks/entities'
export * from './checks/entity-refs'
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
export { type MoveCornerArgs, moveCorner, moveSector } from './model/corner-edits'
export { type Edit, type EditResult, ok, refuse } from './model/edit'
export { type EditCommandOptions, registerEditCommands } from './model/edit-commands'
export {
  createLevelEditor,
  type EditSession,
  type LevelEditor,
  type LevelEditorOptions,
} from './model/level-editor'
export type { LevelState } from './model/level-state'
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
} from './model/sector-edits'
export { parseSelection, type SelectionRef } from './model/selection-ref'
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
  setWindow,
  type WallFlagsArgs,
  type WallKindArgs,
  type WallRef,
  type WindowArgs,
} from './model/wall-edits'
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
