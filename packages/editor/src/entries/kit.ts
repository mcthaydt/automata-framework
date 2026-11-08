// The editor kit's public surface: re-exports only, so what the games and the other editors may use is one list.

export { default as GameFrame } from '../features/suite/tuner/ui/TunerGame.svelte'
export {
  type Command,
  type CommandRegistry,
  createCommandRegistry,
  defineCommand,
} from '../shared/kit/commands/command'
export { normalizeShortcut, parseShortcut, type Shortcut } from '../shared/kit/commands/shortcut'
export { default as ConflictDialog } from '../shared/kit/dialogs/ConflictDialog.svelte'
export {
  autosaveProblem,
  recoveryUnreadable,
  reloadedMessage,
  savedCopyMessage,
  saveFailure,
} from '../shared/kit/dialogs/document-messages'
export { default as RecoveryDialog } from '../shared/kit/dialogs/RecoveryDialog.svelte'
export { retryAction } from '../shared/kit/dialogs/retry-action'
export { default as FieldEditor } from '../shared/kit/fields/FieldEditor.svelte'
export * from '../shared/kit/fields/index'
export { type AttachOptions, attachGestures } from '../shared/kit/gestures/attach-gestures'
export { type GestureClock, realClock } from '../shared/kit/gestures/gesture-clock'
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
} from '../shared/kit/gestures/gesture-events'
export {
  type Modifiers,
  NO_MODIFIERS,
  type PointerKind,
  type PointerSample,
  type WheelInput,
} from '../shared/kit/gestures/pointer-sample'
export { createRecognizer, type GestureOptions, type Recognizer } from '../shared/kit/gestures/recognizer'
export {
  createViewport,
  type Rect,
  type Size,
  type Viewport2D,
  type ViewportInit,
  type ViewportLimits,
} from '../shared/kit/gestures/viewport-2d'
export {
  createHistory,
  type History,
  HistoryError,
  type HistoryErrorCode,
  type HistoryOptions,
  type Transaction,
} from '../shared/kit/history/history'
export { default as FilePick } from '../shared/kit/home/FilePick.svelte'
export { default as HomeScreen } from '../shared/kit/home/HomeScreen.svelte'
export type { PickedFile } from '../shared/kit/home/picked-file'
export {
  cardWords,
  filterEntries,
  type HomeCard,
  modifiedLabel,
  projectCount,
  reconcileSelection,
  type StepKey,
  type StorageNote,
  sizeLabel,
  splitPath,
  stepSelection,
  storageNotes,
  type TilePreview,
  type Tone,
  workspaceSubtitle,
} from '../shared/kit/home/project-browse'
export {
  type BrowserState,
  createProjectBrowser,
  type ProjectBrowser,
  type ProjectBrowserOptions,
  type ProjectListSource,
} from '../shared/kit/home/project-browser'
export { default as Icon } from '../shared/kit/icons/Icon.svelte'
export type { IconName } from '../shared/kit/icons/paths'
export { createKeymap, type KeyInput, type Keymap, type Platform } from '../shared/kit/keymap/keymap'
export { createSelection, type Selection, type SelectionId } from '../shared/kit/selection/selection'
export { default as EditorShell } from '../shared/kit/shell/EditorShell.svelte'
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
  shellModeAt,
  shellModeOf,
} from '../shared/kit/shell/shell-mode'
export { type OpenState, reconcileOpen } from '../shared/kit/shell/shell-open'
export type { StorageClock } from '../shared/kit/storage/clock'
export {
  createDocumentSession,
  type DocumentSession,
  type DocumentSessionOptions,
  type Problem,
  type SaveOutcome,
} from '../shared/kit/storage/document-session'
export {
  createDownloadStore,
  type DownloadEnv,
  type DownloadFile,
  type DownloadStore,
} from '../shared/kit/storage/download-store'
export {
  createFolderStore,
  createIndexedDbVault,
  type FolderEnv,
  type FolderHandle,
  type FolderStore,
  type HandleVault,
  pickFolder,
  restoreFolder,
} from '../shared/kit/storage/folder'
export { createMemoryStore } from '../shared/kit/storage/memory-store'
export {
  flushOnHide,
  type LifecycleDocument,
  type LifecycleWindow,
} from '../shared/kit/storage/page-lifecycle'
export {
  classifyStorageError,
  type ProjectStore,
  StorageError,
  type StorageFailure,
  type StoredEntry,
  statPath,
  type WriteExpectation,
  type WriteFailure,
  type WriteResult,
} from '../shared/kit/storage/project-store'
export { readStored, type Stored } from '../shared/kit/storage/read-stored'
export { discardRecovery, findRecovery, type Recovery } from '../shared/kit/storage/recovery'
export type { SaveState } from '../shared/kit/storage/save-state'
export { openWorkspace, type Workspace, type WorkspaceEnv } from '../shared/kit/storage/workspace'
export { default as ThemeChoice } from '../shared/kit/theme/ThemeChoice.svelte'
export type { EditorTokens } from '../shared/kit/tokens/editor-tokens'
export { tokensToCss } from '../shared/kit/tokens/tokens-to-css'
export { default as Button } from '../shared/kit/widgets/Button.svelte'
export { default as Chips } from '../shared/kit/widgets/Chips.svelte'
export { default as ColorField } from '../shared/kit/widgets/ColorField.svelte'
export { default as Dialog } from '../shared/kit/widgets/Dialog.svelte'
export type { BlockedProps, EditEvent, EditPhase } from '../shared/kit/widgets/edit-event'
export { default as IconButton } from '../shared/kit/widgets/IconButton.svelte'
export { default as Menu } from '../shared/kit/widgets/Menu.svelte'
export { default as Picker } from '../shared/kit/widgets/Picker.svelte'
export { default as Pill } from '../shared/kit/widgets/Pill.svelte'
export type { PickerOption } from '../shared/kit/widgets/picker-model'
export { default as ReorderList } from '../shared/kit/widgets/ReorderList.svelte'
export { moveRow } from '../shared/kit/widgets/reorder-model'
export { default as Segmented } from '../shared/kit/widgets/Segmented.svelte'
export { default as Slider } from '../shared/kit/widgets/Slider.svelte'
export { default as StatusLine } from '../shared/kit/widgets/StatusLine.svelte'
export { default as Stepper } from '../shared/kit/widgets/Stepper.svelte'
export { default as Swatch } from '../shared/kit/widgets/Swatch.svelte'
export { default as Tabs } from '../shared/kit/widgets/Tabs.svelte'
export { default as ToastRegion } from '../shared/kit/widgets/ToastRegion.svelte'
export {
  createToasts,
  type Toast,
  type ToastAction,
  type ToastInput,
  type ToastKind,
  type ToastOptions,
  type ToastStore,
} from '../shared/kit/widgets/toasts'
