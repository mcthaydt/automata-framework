// The headless core of the 2D level editor: the project model, its working file and the profile registry. No Svelte,
// DOM or Pixi in here (`architecture.test.ts` keeps it so); the canvas and the app are separate folders.
export {
  type CellKind,
  type CellProblem,
  decodeRows,
  encodeRows,
  packTile,
  unpackTile,
} from './model/cells-codec'
export { CHUNK, Grid, type GridEditor } from './model/grid'
export { counterIds, DEF_ID, type IdSource, ITEM_ID, randomIds } from './model/ids'
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
  type TemplateDef,
  type ViewDef,
} from './profiles/profile'
export {
  type PatternCell,
  patternCellSchema,
  type Rule,
  type RuleGroup,
  ruleGroupSchema,
  ruleSchema,
} from './tiles/autotile/rule.schema'
