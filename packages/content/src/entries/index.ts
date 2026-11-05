// @mcthaydt/automata-content: the content compiler (M1.3). Extracted from FloorFifty's packages/content
// (122a220) and generalized over game-registered schemas; see the M1.3 spec.

export type { ContentConfig } from '../app/cli/run-cli'
export {
  type CompiledContent,
  type ContentOptions,
  compileContent,
  DEFAULT_OUT_DIR,
  type MessageLocation,
} from '../features/compile/compile-content'
export { ContentCompileFailed, ContentWriteFailed, InvalidContentConfig } from '../features/compile/errors'
export type { SimPartition } from '../features/compile/sim-partition'
export { buildContent, verifyContent } from '../features/compile/write-outputs'
export type { FlowCapabilities, FlowGraph, FlowTransition } from '../features/flow/check-flow'
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
} from '../features/game/game-config.schema'
export type { AssetsSource, GameSource, RukenFields } from '../features/game/game-facts'
export {
  type ContentData,
  type ContentGenerator,
  defineContentGenerator,
  type GeneratorInput,
  type GeneratorOutput,
} from '../features/generate/content-generator'
export type { ParaglideOptions } from '../features/locale/compile-messages'
export { type MessageCatalog, messageKey } from '../features/locale/messages'
export { DEFAULT_PALETTE, type Palette } from '../features/palette/palette'
export { type PreloadInput, preloadList } from '../features/preload/preload-list'
export {
  checkTuningLayer,
  type TunableDeclaration,
  type TunableDeclarations,
  type TuningMeta,
} from '../features/tuning/check-tuning'
export { renderTuningTable, withTuningTable } from '../features/tuning/tuning-table'
export {
  type Diagnostic,
  type DiagnosticCode,
  formatDiagnostic,
  sortDiagnostics,
} from '../shared/diagnostics/diagnostic'
export { contentHash } from '../shared/hash/content-hash'
export {
  type ContentSchemaDef,
  type ContentSchemaOptions,
  type ContentSchemaPlace,
  contentRef,
  defineContentSchema,
  localized,
} from '../shared/schema/content-schema'
