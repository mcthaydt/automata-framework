// What an open document needs around it beyond editing: saving, the autosave journal, the conflict and recovery
// prompts, and letting go cleanly when the page is hidden or closed.
import {
  autosaveProblem,
  recoveryUnreadable,
  reloadedMessage,
  savedCopyMessage,
  saveFailure,
} from '../../shared/kit/dialogs/document-messages.ts'
import { retryAction } from '../../shared/kit/dialogs/retry-action.ts'
import type { Problem, SaveOutcome } from '../../shared/kit/storage/document-session.ts'
import {
  flushOnHide,
  type LifecycleDocument,
  type LifecycleWindow,
} from '../../shared/kit/storage/page-lifecycle.ts'
import { classifyStorageError } from '../../shared/kit/storage/project-store.ts'
import type { Recovery } from '../../shared/kit/storage/recovery.ts'
import type { SaveState } from '../../shared/kit/storage/save-state.ts'
import type { ToastStore } from '../../shared/kit/widgets/toasts.ts'
import type { EditorApp, OpenDocument, OpenOutcome } from '../../shared/level-2d/session/editor-app-types'
import { documentHeading, restoreRefused } from '../../shared/level-2d/session/open-flow-model'
import { openProblem } from '../../shared/level-2d/session/open-problem'

// One open document's flows, in plain TypeScript so
// Node tests drive them: the top bar's undo, redo and Save, what each save outcome does (a conflict opens the Keep mine
// / Take theirs / Save as copy choice, a failure toasts with Retry or Re-grant), the Restore decision for an autosave,
// and writing the journal before the page or the document goes away. It follows the Svelte store contract, so the
// frame reads it as `$state` and a test reads it directly. It never navigates: leaving is its owner's call to `close`.

type Opened = Extract<OpenOutcome, { readonly status: 'opened' }>

export interface DocumentState {
  /** The document on screen. Take theirs replaces it with the file as it is now. */
  readonly document: OpenDocument
  readonly heading: { readonly title: string; readonly file: string }
  readonly save: SaveState
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly undoLabel: string | undefined
  readonly redoLabel: string | undefined
  /** An autosave newer than the file, offered and not yet decided. */
  readonly recovery: Recovery | undefined
  /** The last save found the file changed underneath: the conflict dialog is open. */
  readonly conflict: boolean
  /** A save, or a conflict being resolved; the controls that would start another are disabled meanwhile. */
  readonly busy: 'save' | 'resolve' | undefined
}

export interface DocumentController {
  readonly state: { subscribe(run: (state: DocumentState) => void): () => void }
  undo(): void
  redo(): void
  save(): Promise<void>
  /** Writes the edits over the file that changed. */
  keepMine(): Promise<void>
  /** Reloads the file as it is now; the edits go. When the file no longer opens, nothing changes but a toast. */
  takeTheirs(): Promise<void>
  /** Writes the edits beside the file; the document keeps its own path. */
  saveCopy(): Promise<void>
  dismissConflict(): void
  /** Applies the offered autosave as one undoable step. */
  restore(): void
  /** Throws the offered autosave away. */
  discard(): Promise<void>
  /** Writes the journal, stops listening to the page and lets the document go. Safe to call twice. */
  close(): Promise<void>
}

export interface DocumentControllerOptions {
  readonly app: EditorApp
  readonly opened: Opened
  readonly toasts: ToastStore
  /** The page whose hiding writes the journal (`flushOnHide`). */
  readonly lifecycle: { readonly document: LifecycleDocument; readonly window: LifecycleWindow }
}

export function createDocumentController(options: DocumentControllerOptions): DocumentController {
  const { app, toasts, lifecycle } = options
  let document = options.opened.document
  let recovery = options.opened.recovery
  let conflict = false
  let busy: DocumentState['busy']
  let closed = false

  const listeners = new Set<(state: DocumentState) => void>()
  const current = (): DocumentState => {
    const { history, session } = document
    return {
      document,
      heading: documentHeading(document.profile, history.state, document.path),
      save: session.status,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      undoLabel: history.undoLabel,
      redoLabel: history.redoLabel,
      recovery,
      conflict,
      busy,
    }
  }
  let state = current()
  const publish = (): void => {
    state = current()
    for (const run of [...listeners]) run(state)
  }

  /** Listens to one document: its history and save state redraw, a new autosave problem is told once. */
  function attach(target: OpenDocument): () => void {
    let problem: Problem | undefined = target.session.problem
    const stopHistory = target.history.subscribe(publish)
    const stopSession = target.session.subscribe(() => {
      const next = target.session.problem
      if (next !== problem && next?.source === 'autosave')
        toasts.push({ kind: 'warn', message: autosaveProblem(next) })
      problem = next
      publish()
    })
    const stopHide = flushOnHide(target.session, lifecycle)
    return () => {
      stopHistory()
      stopSession()
      stopHide()
    }
  }
  let detach = attach(document)

  if (options.opened.recoveryError !== undefined)
    toasts.push({ kind: 'warn', message: recoveryUnreadable(options.opened.recoveryError) })

  /** Runs one save or resolution at a time; a second one meanwhile is ignored. */
  async function run(kind: NonNullable<DocumentState['busy']>, work: () => Promise<void>): Promise<void> {
    if (busy !== undefined || closed) return
    busy = kind
    publish()
    try {
      await work()
    } finally {
      busy = undefined
      publish()
    }
  }

  /** What a person hears about a save: nothing when it worked, the dialog on a conflict, a toast with a way on when it failed. */
  function settle(outcome: SaveOutcome): void {
    if (outcome.status === 'conflict') {
      conflict = true
      return
    }
    conflict = false
    if (outcome.status === 'failed')
      toasts.push({
        kind: 'error',
        message: saveFailure(document.path, outcome),
        action: retryAction({ store: app.workspace.store, reason: outcome.reason, toasts, retry: save }),
      })
  }

  function save(): Promise<void> {
    return run('save', async () => settle(await document.save()))
  }

  /** A conflict choice: the dialog closes while it runs, so a choice that conflicts again opens it afresh. */
  function resolve(work: () => Promise<void>): Promise<void> {
    if (busy !== undefined || closed) return Promise.resolve()
    conflict = false
    return run('resolve', work)
  }

  return {
    state: {
      subscribe(listener) {
        listeners.add(listener)
        listener(state)
        return () => {
          listeners.delete(listener)
        }
      },
    },
    undo: () => document.history.undo(),
    redo: () => document.history.redo(),
    save,
    keepMine: () => resolve(async () => settle(await document.overwrite())),
    saveCopy: () =>
      resolve(async () => {
        const outcome = await document.saveCopy()
        settle(outcome)
        if (outcome.status === 'saved') toasts.push({ kind: 'ok', message: savedCopyMessage(outcome.path) })
      }),
    takeTheirs: () =>
      resolve(async () => {
        const old = document
        // Open first: only a file that opens may replace the person's edits.
        const outcome = await app.open(old.path, old.profile.id)
        // Left (Back) while the file was read: the old document is already closed; the new one must not outlive it.
        if (closed) {
          if (outcome.status === 'opened') outcome.document.dispose()
          return
        }
        if (outcome.status !== 'opened') {
          toasts.push({ kind: 'error', message: openProblem(outcome) })
          return
        }
        detach()
        // The old journal is removed through its own session, after any write it still has in flight.
        await old.session.discardJournal().catch(() => undefined)
        if (closed) {
          outcome.document.dispose()
          return
        }
        old.dispose()
        document = outcome.document
        recovery = undefined
        detach = attach(document)
        toasts.push({ kind: 'info', message: reloadedMessage(document.path) })
      }),
    dismissConflict() {
      conflict = false
      publish()
    },
    restore() {
      if (recovery === undefined) return
      const restored = document.restore(recovery)
      // A refused autosave stays on offer: Discard is how the person goes on with the file as saved.
      if (restored.ok) recovery = undefined
      else toasts.push({ kind: 'error', message: restoreRefused(restored.error) })
      publish()
    },
    async discard() {
      if (recovery === undefined) return
      recovery = undefined
      publish()
      try {
        await document.discardRecovery()
      } catch (error) {
        toasts.push({
          kind: 'error',
          message: `The autosave could not be removed: ${classifyStorageError(error).message}`,
        })
      }
    },
    async close() {
      if (closed) return
      closed = true
      detach()
      // The autosave drops a pending write when disposed, so the last edits are written first.
      await document.session.flush().catch(() => undefined)
      document.dispose()
    },
  }
}
