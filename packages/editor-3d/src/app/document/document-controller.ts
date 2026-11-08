// One open level's flows (plan ED3D.5c, decisions 6 to 8; ED3D spec §5.3 flow 9, §8, §11; kit spec §5 flows 3 and 4),
// in plain TypeScript so Node tests drive them: the top bar's undo, redo and Save, what each save outcome does (a
// conflict opens Keep mine / Take theirs / Save as copy, a failure toasts with Retry, a refused patch holds Save and opens
// the held dialog, ED3-o), the Restore decision for an autosave, and writing the journal before the page or the level
// goes away. It follows the Svelte store contract, so the frame reads it as `$state` and a test reads it directly. It
// never navigates: leaving is its owner's call to `close`. The facility beside a Last Light level is let go with the
// level; editing it is World's (ED3D.9c).
import {
  autosaveProblem,
  classifyStorageError,
  flushOnHide,
  type LifecycleDocument,
  type LifecycleWindow,
  type Problem,
  type Recovery,
  recoveryUnreadable,
  reloadedMessage,
  retryAction,
  type SaveState,
  savedCopyMessage,
  saveFailure,
  type ToastStore,
} from '@mcthaydt/automata-editor/kit/core'
import type { EditorApp, OpenOutcome } from '../editor-app'
import type { FacilityOutcome, OpenLevel } from '../open-level'
import type { DocumentSaveOutcome, PatchRefused } from '../patched-document'
import {
  documentHeading,
  errorPanel,
  exportedMessage,
  needsPanel,
  reformattedMessage,
  restoreRefused,
} from './open-flow-model'

type Opened = Extract<OpenOutcome, { readonly status: 'opened' }>

export interface DocumentState {
  /** The level on screen. Take theirs replaces it with the file as it is now. */
  readonly level: OpenLevel
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
  /** The patch's refusal while Save is held (ED3-o). */
  readonly held: PatchRefused | undefined
  /** The held dialog is open. */
  readonly heldOpen: boolean
  /** A save, or a conflict or held Save being resolved; the controls that would start another are disabled meanwhile. */
  readonly busy: 'save' | 'resolve' | undefined
}

export interface DocumentController {
  readonly state: { subscribe(run: (state: DocumentState) => void): () => void }
  undo(): void
  redo(): void
  /** Saves; while Save is held it only opens the held dialog again. */
  save(): Promise<void>
  /** Writes the edits over the file that changed. */
  keepMine(): Promise<void>
  /** Reloads the file as it is now; the edits go. When the file no longer opens, nothing changes but a toast. */
  takeTheirs(): Promise<void>
  /** Writes the edits beside the file; the level keeps its own path. */
  saveCopy(): Promise<void>
  dismissConflict(): void
  /** Writes the whole level in the editor's layout, so Save is no longer held. */
  saveReformatted(): Promise<void>
  /** Downloads the level and leaves the file alone. */
  exportCopy(): Promise<void>
  dismissHeld(): void
  /** Applies the offered autosave as one undoable step. */
  restore(): void
  /** Throws the offered autosave away. */
  discard(): Promise<void>
  /** Writes the journal, stops listening to the page and lets the level (and its facility) go. Safe to call twice. */
  close(): Promise<void>
}

export interface DocumentControllerOptions {
  readonly app: EditorApp
  readonly opened: Opened
  readonly toasts: ToastStore
  /** The page whose hiding writes the journal (`flushOnHide`). */
  readonly lifecycle: { readonly document: LifecycleDocument; readonly window: LifecycleWindow }
}

/** Lets an open facility go: its journal first, then the document. */
async function closeFacility(facility: FacilityOutcome | undefined): Promise<void> {
  if (facility?.status !== 'opened') return
  await facility.facility.document.session.flush().catch(() => undefined)
  facility.facility.document.dispose()
}

export function createDocumentController(options: DocumentControllerOptions): DocumentController {
  const { app, toasts, lifecycle } = options
  let level = options.opened.level
  let facility = options.opened.facility
  let recovery = options.opened.recovery
  let conflict = false
  let heldOpen = false
  let busy: DocumentState['busy']
  let closed = false

  const listeners = new Set<(state: DocumentState) => void>()
  const current = (): DocumentState => {
    const { history } = level.editor
    return {
      level,
      heading: documentHeading(level.path),
      save: level.document.session.status,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      undoLabel: history.undoLabel,
      redoLabel: history.redoLabel,
      recovery,
      conflict,
      held: level.document.held,
      heldOpen,
      busy,
    }
  }
  let state = current()
  const publish = (): void => {
    state = current()
    for (const run of [...listeners]) run(state)
  }

  /** Listens to one level: its history and save state redraw, a new autosave problem is told once. */
  function attach(target: OpenLevel): () => void {
    const { session } = target.document
    let problem: Problem | undefined = session.problem
    const stopHistory = target.editor.history.subscribe(publish)
    const stopSession = session.subscribe(() => {
      const next = session.problem
      if (next !== problem && next?.source === 'autosave')
        toasts.push({ kind: 'warn', message: autosaveProblem(next) })
      problem = next
      publish()
    })
    const stopHide = flushOnHide(session, lifecycle)
    return () => {
      stopHistory()
      stopSession()
      stopHide()
    }
  }
  let detach = attach(level)

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

  /** What a person hears about a save: nothing when it worked, a dialog on a conflict or a refusal, a toast when it failed. */
  function settle(outcome: DocumentSaveOutcome): void {
    conflict = outcome.status === 'conflict'
    heldOpen = outcome.status === 'refused'
    if (outcome.status === 'failed')
      toasts.push({
        kind: 'error',
        message: saveFailure(level.path, outcome),
        action: retryAction({ store: app.workspace.store, reason: outcome.reason, toasts, retry: save }),
      })
  }

  function save(): Promise<void> {
    // A save or a dialog's choice is running: its outcome decides what shows next.
    if (busy !== undefined || closed) return Promise.resolve()
    if (level.document.held !== undefined) {
      // Save is held: the dialog is the way on, and nothing is written.
      heldOpen = true
      publish()
      return Promise.resolve()
    }
    return run('save', async () => settle(await level.document.save()))
  }

  /** A choice in a dialog: the dialog closes while it runs, so a choice that ends in one again opens it afresh. */
  function resolve(work: () => Promise<void>): Promise<void> {
    if (busy !== undefined || closed) return Promise.resolve()
    conflict = false
    heldOpen = false
    return run('resolve', work)
  }

  async function takeTheirs(): Promise<void> {
    const old = level
    const oldFacility = facility
    // Open first: only a file that opens may replace the person's edits.
    const outcome = await app.open(old.path)
    // Left (Back) while the file was read: the old level is already closed; the new one must not outlive it.
    if (closed) {
      if (outcome.status === 'opened') {
        outcome.level.document.dispose()
        await closeFacility(outcome.facility)
      }
      return
    }
    if (outcome.status !== 'opened') {
      const message = needsPanel(outcome)
        ? errorPanel(outcome).title
        : `${old.path}: ${outcome.status === 'storageFailed' ? outcome.message : 'no longer in this workspace'}`
      toasts.push({ kind: 'error', message })
      return
    }
    detach()
    // The old journal is removed through its own session, after any write it still has in flight.
    await old.document.session.discardJournal().catch(() => undefined)
    if (closed) {
      outcome.level.document.dispose()
      await closeFacility(outcome.facility)
      return
    }
    old.document.dispose()
    await closeFacility(oldFacility)
    level = outcome.level
    facility = outcome.facility
    recovery = undefined
    detach = attach(level)
    toasts.push({ kind: 'info', message: reloadedMessage(level.path) })
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
    undo: () => level.editor.history.undo(),
    redo: () => level.editor.history.redo(),
    save,
    keepMine: () => resolve(async () => settle(await level.document.overwrite())),
    saveCopy: () =>
      resolve(async () => {
        const outcome = await level.document.saveCopy()
        settle(outcome)
        if (outcome.status === 'saved') toasts.push({ kind: 'ok', message: savedCopyMessage(outcome.path) })
      }),
    takeTheirs: () => resolve(takeTheirs),
    dismissConflict() {
      conflict = false
      publish()
    },
    saveReformatted: () =>
      resolve(async () => {
        const outcome = await level.document.saveReformatted()
        settle(outcome)
        if (outcome.status === 'saved') toasts.push({ kind: 'ok', message: reformattedMessage(level.path) })
      }),
    exportCopy: () =>
      resolve(async () => {
        const outcome = await level.document.exportCopy()
        if (outcome.status === 'exported') toasts.push({ kind: 'ok', message: exportedMessage(outcome.name) })
        else if (outcome.status === 'refused') heldOpen = true
        else toasts.push({ kind: 'error', message: `Could not export ${level.path}: ${outcome.message}` })
      }),
    dismissHeld() {
      heldOpen = false
      publish()
    },
    restore() {
      if (recovery === undefined) return
      const restored = level.document.restore(recovery)
      // A refused autosave stays on offer: Discard is how the person goes on with the file as saved.
      if (restored.ok) recovery = undefined
      else toasts.push({ kind: 'error', message: restoreRefused(restored.issues) })
      publish()
    },
    async discard() {
      if (recovery === undefined) return
      recovery = undefined
      publish()
      try {
        await level.document.discardRecovery()
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
      await level.document.session.flush().catch(() => undefined)
      level.document.dispose()
      await closeFacility(facility)
    },
  }
}
