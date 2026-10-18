// @mcthaydt/automata-content: the content compiler (M1.3). Extracted from FloorFifty's packages/content
// (122a220) and generalized over game-registered schemas; see the M1.3 spec.

export type { ContentConfig } from './cli/run-cli'
export {
  type CompiledContent,
  type ContentOptions,
  compileContent,
  DEFAULT_OUT_DIR,
  type MessageLocation,
} from './compile/compile-content'
export { ContentCompileFailed, ContentWriteFailed, InvalidContentConfig } from './compile/errors'
export type { SimPartition } from './compile/sim-partition'
export { buildContent, verifyContent } from './compile/write-outputs'
export {
  type Diagnostic,
  type DiagnosticCode,
  formatDiagnostic,
  sortDiagnostics,
} from './diagnostics/diagnostic'
export type { FlowCapabilities, FlowGraph, FlowTransition } from './flow/check-flow'
export type { AssetsSource, GameSource, RukenFields } from './game/game-facts'
export {
  type ContentData,
  type ContentGenerator,
  defineContentGenerator,
  type GeneratorInput,
  type GeneratorOutput,
} from './generate/content-generator'
export { contentHash } from './hash/content-hash'
export type { ParaglideOptions } from './locale/compile-messages'
export { type MessageCatalog, messageKey } from './locale/messages'
export { DEFAULT_PALETTE, type Palette } from './palette/palette'
export { type PreloadInput, preloadList } from './preload/preload-list'
export {
  type ContentSchemaDef,
  type ContentSchemaOptions,
  type ContentSchemaPlace,
  contentRef,
  defineContentSchema,
  localized,
} from './schema/content-schema'
export {
  checkTuningLayer,
  type TunableDeclaration,
  type TunableDeclarations,
  type TuningMeta,
} from './tuning/check-tuning'
export { renderTuningTable, withTuningTable } from './tuning/tuning-table'
