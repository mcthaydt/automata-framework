// @automataframework/automata-content/level-2d: the 2D level format the editor writes and a game reads. The three file shapes
// (`project.toml`, `levels/<id>.toml`, `world.toml`) as strict schemas and types, and the typed-field rules they use.
// Browser-safe: zod and plain functions, no Node built-ins, so a game's sim may import it too.
export {
  checkEntityDef,
  checkFieldDef,
  defaultFieldValue,
} from '../shared/level-2d/check-field-def.ts'
export { checkFieldValue } from '../shared/level-2d/check-field-value.ts'
export {
  type ContentEntityDef,
  type ContentEntityItem,
  type ContentLevel,
  type ContentLevelLayer,
  type ContentNeighbours,
  type ContentObjectItem,
  type ContentProject,
  type ContentProjectLayer,
  type ContentRows,
  type ContentSize,
  type ContentTileset,
  type ContentWorld,
  levelContentSchema,
  projectContentSchema,
  worldContentSchema,
} from '../shared/level-2d/content.schema.ts'
export {
  ENTITY_ID,
  type EntityDef,
  type EntityDefCode,
  type EntityDefProblem,
  FIELD_ID,
  FIELD_TYPES,
  type FieldDef,
  type FieldDefCode,
  type FieldProblem,
  type FieldType,
  type FieldValue,
  type FieldValueCode,
  type FieldValueProblem,
  type FieldValues,
  HEX_COLOR,
  type InstanceCode,
  type InstanceProblem,
  type Point,
  type RefValue,
} from '../shared/level-2d/field-types.ts'
export {
  type EntityDefIssue,
  entityDefIssues,
  entityDefSchema,
  entityDefShape,
  fieldDefSchema,
  fieldValueSchema,
  fieldValuesSchema,
} from '../shared/level-2d/fields.schema.ts'
export { type Level2dKindsOptions, level2dKinds } from '../shared/level-2d/level-2d-kinds.ts'
export { entitiesOf, intGridRows } from '../shared/level-2d/read-level.ts'
