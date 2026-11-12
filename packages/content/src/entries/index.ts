// @automata/content: the content compiler, generic over the schemas a game
// registers.

export type { ContentConfig } from '../app/cli/run-cli.ts'
export { type PreloadInput, preloadList } from '../features/preload/preload-list.ts'
export {
  type CompileContentResult,
  type CompiledContent,
  type ContentOptions,
  compileContent,
  compileContentResult,
  DEFAULT_OUT_DIR,
  type MessageLocation,
} from '../shared/compile/compile-content.ts'
export { ContentCompileFailed, ContentWriteFailed, InvalidContentConfig } from '../shared/compile/errors.ts'
export type { SimPartition } from '../shared/compile/sim-partition.ts'
export { buildContent, verifyContent } from '../shared/compile/write-outputs.ts'
export {
  type Diagnostic,
  type DiagnosticCode,
  formatDiagnostic,
  sortDiagnostics,
} from '../shared/diagnostics/diagnostic.ts'
export type { FlowCapabilities, FlowGraph, FlowTransition } from '../shared/flow/check-flow.ts'
export {
  type AchievementConfig,
  type AchievementGoal,
  GAME_ID_PATTERN,
  type GameConfig,
  gameConfigSchema,
  INPUTS,
  type Input,
  LEADERBOARD_ORDERS,
  type LeaderboardConfig,
  ORIENTATIONS,
  type Orientation,
  RATINGS,
  type Rating,
  RENDERERS,
  type Renderer,
} from '../shared/game/game-config.schema.ts'
export type { AssetsSource, GameSource, RukenFields } from '../shared/game/game-facts.ts'
export {
  type ContentData,
  type ContentGenerator,
  defineContentGenerator,
  type GeneratorInput,
  type GeneratorOutput,
} from '../shared/generate/content-generator.ts'
export { contentHash } from '../shared/hash/content-hash.ts'
export type { ParaglideOptions } from '../shared/locale/compile-messages.ts'
export { type MessageCatalog, messageKey } from '../shared/locale/messages.ts'
export { DEFAULT_PALETTE, type Palette } from '../shared/palette/palette.ts'
export {
  type ContentSchemaDef,
  type ContentSchemaOptions,
  type ContentSchemaPlace,
  contentRef,
  defineContentSchema,
  localized,
} from '../shared/schema/content-schema.ts'
export {
  checkTuningLayer,
  type TunableDeclaration,
  type TunableDeclarations,
  type TuningMeta,
} from '../shared/tuning/check-tuning.ts'
export { renderTuningTable, withTuningTable } from '../shared/tuning/tuning-table.ts'
