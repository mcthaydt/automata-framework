// The editor kit without its Svelte parts: history, selection, the command registry, the keymap and the 2D viewport. An editor's headless
// layers import this entry, so they load on Node (and in a worker) without the Svelte compiler; the root entry adds the
// shell on top of the same modules.
export { type Command, type CommandRegistry, createCommandRegistry, defineCommand } from '../commands/command'
export { normalizeShortcut, parseShortcut, type Shortcut } from '../commands/shortcut'
export type { Point } from '../fields/field-types'
export type { PointerKind } from '../gestures/pointer-sample'
export {
  createViewport,
  type Rect,
  type Size,
  type Viewport2D,
  type ViewportInit,
  type ViewportLimits,
} from '../gestures/viewport-2d'
export {
  createHistory,
  type History,
  HistoryError,
  type HistoryErrorCode,
  type HistoryOptions,
  type Transaction,
} from '../history/history'
export { createKeymap, type KeyInput, type Keymap, type Platform } from '../keymap/keymap'
export { createSelection, type Selection, type SelectionId } from '../selection/selection'
