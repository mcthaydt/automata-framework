export { default as DebugOverlay } from '../features/overlay/DebugOverlay.svelte'
export { debugExtension } from '../features/overlay/debug.extension'
export {
  createOverlay,
  type Overlay,
  type OverlayOptions,
  type OverlayState,
} from '../features/overlay/overlay'
export { type AudioControls, audioBoard } from '../features/panels/audio-board'
export { feelBoard } from '../features/panels/feel-board'
export { shippedPanels } from '../features/panels/shipped-panels'
export { type FactEntry, type FactLog, RUNTIME_FACTS, recordFacts } from '../shared/fact-log'
export {
  type AudioBoardBed,
  type AudioBoardCue,
  type AudioBoardPort,
  type BusPort,
  type DebugHost,
  type FeelBoardPort,
  installDebug,
  type NetDiagnosticsPort,
  type SimProbe,
  type SummaryPort,
} from '../shared/host'
export { type DebugPanelDef, debugPanels, summaryPanel } from '../shared/panels'
export { type SummaryRow, summaryRows } from '../shared/summary-rows'
