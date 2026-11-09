// @automata/content: the content compiler, generic over the schemas a game
// registers.

export type { ContentConfig } from '../app/cli/run-cli'
export { type PreloadInput, preloadList } from '../features/preload/preload-list'
export {
  type CompileContentResult,
  type CompiledContent,
  type ContentOptions,
  compileContent,
  compileContentResult,
  DEFAULT_OUT_DIR,
  type MessageLocation,
} from '../shared/compile/compile-content'
export { ContentCompileFailed, ContentWriteFailed, InvalidContentConfig } from '../shared/compile/errors'
export type { SimPartition } from '../shared/compile/sim-partition'
export { buildContent, verifyContent } from '../shared/compile/write-outputs'
export {
  type Diagnostic,
  type DiagnosticCode,
  formatDiagnostic,
  sortDiagnostics,
} from '../shared/diagnostics/diagnostic'
export type { FlowCapabilities, FlowGraph, FlowTransition } from '../shared/flow/check-flow'
export {
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
} from '../shared/game/game-config.schema'
export type { AssetsSource, GameSource, RukenFields } from '../shared/game/game-facts'
export {
  type ContentData,
  type ContentGenerator,
  defineContentGenerator,
  type GeneratorInput,
  type GeneratorOutput,
} from '../shared/generate/content-generator'
export { contentHash } from '../shared/hash/content-hash'
export type { ParaglideOptions } from '../shared/locale/compile-messages'
export { type MessageCatalog, messageKey } from '../shared/locale/messages'
export { DEFAULT_PALETTE, type Palette } from '../shared/palette/palette'
export {
  type ContentSchemaDef,
  type ContentSchemaOptions,
  type ContentSchemaPlace,
  contentRef,
  defineContentSchema,
  localized,
} from '../shared/schema/content-schema'
export {
  checkTuningLayer,
  type TunableDeclaration,
  type TunableDeclarations,
  type TuningMeta,
} from '../shared/tuning/check-tuning'
export { renderTuningTable, withTuningTable } from '../shared/tuning/tuning-table'
