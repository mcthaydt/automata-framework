export { type Command, type CommandRegistry, createCommandRegistry, defineCommand } from './commands/command'
export { normalizeShortcut, parseShortcut, type Shortcut } from './commands/shortcut'
export {
  createHistory,
  type History,
  HistoryError,
  type HistoryErrorCode,
  type HistoryOptions,
  type Transaction,
} from './history/history'
export { createKeymap, type KeyInput, type Keymap, type Platform } from './keymap/keymap'
export { createSelection, type Selection, type SelectionId } from './selection/selection'
export { default as EditorShell } from './shell/EditorShell.svelte'
export {
  DETENTS,
  type Detent,
  type DockPlacement,
  defaultDockOpen,
  detentLength,
  dockPlacementOf,
  nextDetent,
  type ShellMode,
  type ShellRegion,
  shellModeOf,
} from './shell/shell-mode'
export { type OpenState, reconcileOpen } from './shell/shell-open'
export type { EditorTokens, RampEntry } from './tokens/editor-tokens'
export { tokensToCss } from './tokens/tokens-to-css'
