// The editor kit without its Svelte parts: history, selection, the command registry, the keymap, the 2D viewport,
// storage and the toast store. An editor's headless layers import this entry, so they load on Node (and in a worker)
// without the Svelte compiler; the root entry adds the shell and the widgets on top of the same modules.

export type { Point } from '@automataframework/automata-content/level-2d'
export { type Command, type CommandRegistry, createCommandRegistry, defineCommand } from '../commands/command'
export { normalizeShortcut, parseShortcut, type Shortcut } from '../commands/shortcut'
export {
  autosaveProblem,
  recoveryUnreadable,
  reloadedMessage,
  savedCopyMessage,
  saveFailure,
} from '../dialogs/document-messages'
export { retryAction } from '../dialogs/retry-action'
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
  type Tone,
  workspaceSubtitle,
} from '../home/project-browse'
export {
  type BrowserState,
  createProjectBrowser,
  type ProjectBrowser,
  type ProjectBrowserOptions,
  type ProjectListSource,
} from '../home/project-browser'
export { createKeymap, type KeyInput, type Keymap, type Platform } from '../keymap/keymap'
export { createSelection, type Selection, type SelectionId } from '../selection/selection'
export type { StorageClock } from '../storage/clock'
export {
  createDocumentSession,
  type DocumentSession,
  type DocumentSessionOptions,
  type Problem,
  type SaveOutcome,
} from '../storage/document-session'
export {
  createDownloadStore,
  type DownloadEnv,
  type DownloadFile,
  type DownloadStore,
} from '../storage/download-store'
export {
  createFolderStore,
  createIndexedDbVault,
  type FolderEnv,
  type FolderHandle,
  type FolderStore,
  type HandleVault,
  pickFolder,
  restoreFolder,
} from '../storage/folder'
export { createHttpStore, type HttpStoreOptions } from '../storage/http-store'
export { createMemoryStore } from '../storage/memory-store'
export { flushOnHide, type LifecycleDocument, type LifecycleWindow } from '../storage/page-lifecycle'
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
} from '../storage/project-store'
export { readStored, type Stored } from '../storage/read-stored'
export { discardRecovery, findRecovery, type Recovery } from '../storage/recovery'
export type { SaveState } from '../storage/save-state'
export { storePathProblem } from '../storage/store-path'
export {
  openServedWorkspace,
  openWorkspace,
  type ServedWorkspaceEnv,
  type Workspace,
  type WorkspaceEnv,
} from '../storage/workspace'
export {
  createToasts,
  type Toast,
  type ToastAction,
  type ToastInput,
  type ToastKind,
  type ToastOptions,
  type ToastStore,
} from '../widgets/toasts'
