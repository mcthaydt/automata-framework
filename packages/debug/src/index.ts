export { default as DebugOverlay } from './DebugOverlay.svelte'
export { debugExtension } from './debug.extension'
export {
  type BusPort,
  type DebugHost,
  type FeelBoardPort,
  installDebug,
  type SimProbe,
} from './host'
export { createOverlay, type Overlay, type OverlayOptions, type OverlayState } from './overlay'
export { type DebugPanelDef, debugPanels } from './panels'
