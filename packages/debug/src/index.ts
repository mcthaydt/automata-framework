export { default as DebugOverlay } from './DebugOverlay.svelte'
export { debugExtension } from './debug.extension'
export { type FactEntry, type FactLog, RUNTIME_FACTS, recordFacts } from './fact-log'
export { feelBoard } from './feel-board'
export {
  type BusPort,
  type DebugHost,
  type FeelBoardPort,
  installDebug,
  type NetDiagnosticsPort,
  type SimProbe,
} from './host'
export { createOverlay, type Overlay, type OverlayOptions, type OverlayState } from './overlay'
export { type DebugPanelDef, debugPanels } from './panels'
export { shippedPanels } from './shipped-panels'
export { type SummaryRow, summaryRows } from './summary-rows'
