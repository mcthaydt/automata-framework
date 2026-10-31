// The headless core of the 2D level editor: the project model, its working file, the profile registry, the Level view
// controller and the canvas's draw list. No Svelte, DOM or Pixi in here (`architecture.test.ts` keeps the core so).
export {
  createLevelEditor,
  type EditHistory,
  type LevelEditor,
  type LevelEditorOptions,
  type LevelEditorView,
  type LevelTool,
} from './app/level-editor'
export type {
  DrawView,
  EntityDraw,
  Footprint,
  GridLines,
  IntCellDraw,
  IntChunk,
  LayerDraw,
  LevelDrawInput,
  LevelDrawList,
  ObjectDraw,
  PlaceholderReason,
  TileChunk,
  TileDraw,
} from './canvas/draw/draw-list-types'
export { createLevelDrawList } from './canvas/draw/level-draw-list'
export {
  type CellKind,
  type CellProblem,
  decodeRows,
  encodeRows,
  packTile,
  unpackTile,
} from './model/cells-codec'
export {
  cellWord,
  eraseLayerCells,
  fillLayer,
  paintLayerCells,
  paintLayerRandom,
  paintLayerRect,
  pasteLayerStamp,
} from './model/commands/cell-edits'
export type { DefinitionUse, GuardedEdit } from './model/commands/def-lookup'
export { type DefinitionRef, definitionUses, deleteDefinition } from './model/commands/definition-uses'
export {
  addEntityDef,
  type EntityDefPatch,
  editEntityDef,
  renameEntityDef,
} from './model/commands/entity-def-edits'
export {
  deleteEntity,
  duplicateEntity,
  moveEntity,
  placeEntity,
  resizeEntity,
  setEntityField,
} from './model/commands/entity-edits'
export { type Bounds, entityAt, entityBounds, entityDefOf } from './model/commands/entity-geometry'
export { addField, renameField, retypeField } from './model/commands/field-edits'
export type { FieldOwner } from './model/commands/field-owner'
export {
  addLayerDef,
  editLayerDef,
  reorderLayerDefs,
  setIntValue,
} from './model/commands/layer-def-edits'
export { findLayer, type LayerTarget, updateLayer } from './model/commands/layer-target'
export { deleteObject, flipObject, moveObject, placeObject } from './model/commands/object-edits'
export {
  addRule,
  addRuleGroup,
  deleteRule,
  deleteRuleGroup,
  editRule,
  editRuleGroup,
  newRule,
  nextPatternCell,
  type RulePatch,
  reorderRuleGroups,
  reorderRules,
  resizeRule,
  setPatternCell,
} from './model/commands/rule-edits'
export { addTileset, importTileset, tagTiles, untagTiles } from './model/commands/tileset-edits'
export { CHUNK, Grid, type GridChunk, type GridEditor } from './model/grid'
export { counterIds, DEF_ID, type IdSource, ITEM_ID, randomIds } from './model/ids'
export { emptyLayers, layerCells } from './model/level-layers'
export { FILE_VERSION, type Migration, type RawFile } from './model/migrations/migration'
export { MAX_FILE_CHARS, type OpenResult, openProject } from './model/open-project'
export { projectFileSchema } from './model/project.schema'
export {
  type DecodeResult,
  decodeProject,
  encodeProject,
  type OpenIssue,
  printProject,
} from './model/project-codec'
export type {
  AutoLayerDef,
  AutoLayerFile,
  AutoLayerInstance,
  Background,
  BackgroundMode,
  Definitions,
  EntitiesLayerDef,
  EntitiesLayerInstance,
  EntityDef2D,
  EntityInstance,
  EntityResize,
  EntityShape,
  IntGridLayerDef,
  IntGridLayerFile,
  IntGridLayerInstance,
  IntValueDef,
  LayerDef,
  LayerInstance,
  LayerInstanceFile,
  Level,
  ObjectInstance,
  ObjectsLayerDef,
  ObjectsLayerInstance,
  Placement,
  Project,
  ProjectFile,
  RowStrings,
  Size,
  TilesetDef,
  TilesLayerDef,
  TilesLayerFile,
  TilesLayerInstance,
  World,
  WorldLayout,
} from './model/project-types'
export { tilesetTiles } from './model/tileset-grid'
export {
  addLevel,
  duplicateLevel,
  type NewLevel,
  removeLevel,
  setLevelField,
} from './model/world/level-edits'
export { moveLevelInWorld, placeLevel, setLevelDepth } from './model/world/level-placement'
export {
  type AnchorSide,
  type DroppedCells,
  type ResizeAnchor,
  resizeLevel,
  resizeLevelLoss,
} from './model/world/level-resize'
export { setWorldLayout } from './model/world/world-layout'
export { type LevelNeighbours, worldNeighbours } from './model/world/world-neighbours'
export {
  createProfileRegistry,
  type Diagnostic,
  type ExportTarget,
  type ParseError,
  type Profile,
  type ProfileRegistry,
  type ProjectContext,
  type Result,
  type Severity,
  type TargetChoice,
  type TemplateDef,
  type ViewDef,
} from './profiles/profile'
export {
  type AutoTiles,
  applyOverrides,
  autoTiles,
  patchAutoTiles,
  windowAround,
} from './tiles/autotile/auto-tiles'
export { type AutoTile, type CompiledRules, compileRules, evaluateCell } from './tiles/autotile/match'
export {
  type PatternCell,
  patternCellSchema,
  type Rule,
  type RuleGroup,
  ruleGroupSchema,
  ruleSchema,
} from './tiles/autotile/rule.schema'
export { type RuleContext, type RuleIssue, ruleIssues } from './tiles/autotile/rule-issues'
export { floodFill } from './tiles/flood-fill'
export { brushCells, lineCells, type Point } from './tiles/footprint'
export { paintCells, paintRandom, paintRect } from './tiles/paint'
export { copyStamp, flipStamp, pasteStamp, type Stamp } from './tiles/stamp'
export { flipCell, pickTile } from './tiles/tile-cell'
