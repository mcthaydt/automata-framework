export { type Command, type CommandRegistry, createCommandRegistry, defineCommand } from './commands/command'
export { normalizeShortcut, parseShortcut, type Shortcut } from './commands/shortcut'
export { type AttachOptions, attachGestures } from './gestures/attach-gestures'
export { type GestureClock, realClock } from './gestures/gesture-clock'
export type {
  DragEndGesture,
  DragGesture,
  DragStartGesture,
  GestureHandlers,
  HoverGesture,
  LongPressGesture,
  MultiTapGesture,
  PanGesture,
  PinchGesture,
  TapGesture,
  TransformPhase,
  WheelGesture,
} from './gestures/gesture-events'
export {
  type Modifiers,
  NO_MODIFIERS,
  type PointerKind,
  type PointerSample,
  type WheelInput,
} from './gestures/pointer-sample'
export { createRecognizer, type GestureOptions, type Recognizer } from './gestures/recognizer'
export {
  createViewport,
  type Point,
  type Rect,
  type Size,
  type Viewport2D,
  type ViewportInit,
  type ViewportLimits,
} from './gestures/viewport-2d'
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
export type { StorageClock } from './storage/clock'
export {
  createDocumentSession,
  type DocumentSession,
  type DocumentSessionOptions,
  type Problem,
  type SaveOutcome,
} from './storage/document-session'
export {
  createDownloadStore,
  type DownloadEnv,
  type DownloadFile,
  type DownloadStore,
} from './storage/download-store'
export {
  createFolderStore,
  createIndexedDbVault,
  type FolderEnv,
  type FolderHandle,
  type FolderStore,
  type HandleVault,
  pickFolder,
  restoreFolder,
} from './storage/folder'
export { createMemoryStore } from './storage/memory-store'
export { flushOnHide, type LifecycleDocument, type LifecycleWindow } from './storage/page-lifecycle'
export {
  classifyStorageError,
  type ProjectStore,
  StorageError,
  type StorageFailure,
  type StoredEntry,
  statPath,
  type WriteFailure,
  type WriteResult,
} from './storage/project-store'
export { discardRecovery, findRecovery, type Recovery } from './storage/recovery'
export type { SaveState } from './storage/save-state'
export { openWorkspace, type Workspace, type WorkspaceEnv } from './storage/workspace'
export type { EditorTokens, RampEntry } from './tokens/editor-tokens'
export { tokensToCss } from './tokens/tokens-to-css'
export { default as Chips } from './widgets/Chips.svelte'
export { default as ColorField } from './widgets/ColorField.svelte'
export { default as Dialog } from './widgets/Dialog.svelte'
export type { BlockedProps, EditEvent, EditPhase } from './widgets/edit-event'
export { default as Menu } from './widgets/Menu.svelte'
export { default as Picker } from './widgets/Picker.svelte'
export type { PickerOption } from './widgets/picker-model'
export { default as ReorderList } from './widgets/ReorderList.svelte'
export { moveRow } from './widgets/reorder-model'
export { default as Segmented } from './widgets/Segmented.svelte'
export { default as Slider } from './widgets/Slider.svelte'
export { default as StatusLine } from './widgets/StatusLine.svelte'
export { default as Stepper } from './widgets/Stepper.svelte'
export { default as Swatch } from './widgets/Swatch.svelte'
export { default as Tabs } from './widgets/Tabs.svelte'
export { default as ToastRegion } from './widgets/ToastRegion.svelte'
export {
  createToasts,
  type Toast,
  type ToastAction,
  type ToastInput,
  type ToastKind,
  type ToastOptions,
  type ToastStore,
} from './widgets/toasts'
