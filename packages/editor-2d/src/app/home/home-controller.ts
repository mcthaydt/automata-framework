import { classifyStorageError, type ToastKind, type ToastStore } from '@mcthaydt/automata-editor-kit/core'
import { type ChoiceOutcome, needsPanel, type PanelOutcome } from '../document/open-flow-model'
import type { EditorApp, ImportOutcome, OpenOutcome } from '../editor-app'
import type { ProjectEntry } from '../project-list'
import {
  duplicateMessage,
  filterProjects,
  importNotices,
  openProblem,
  reconcileSelection,
  removeMessage,
  type StepKey,
  stepSelection,
} from './home-model'

// The state machine behind Home (plan ED2D.4c2a, decision 1): what the list shows, what is selected, which action is
// running, and what each action does to the list. It never navigates and draws nothing: when a document opens it tells
// its owner, and every outcome a person should hear about goes to the toast store. It follows the Svelte store
// contract (`state.subscribe`), so a component reads it as `$state` and a Node test reads it directly.

export type Busy = 'open' | 'create' | 'duplicate' | 'remove' | 'import'

export interface HomeState {
  /** `loading` until the first listing; `unavailable` when the workspace cannot be listed. */
  readonly phase: 'loading' | 'ready' | 'unavailable'
  /** Every project, newest first. */
  readonly entries: readonly ProjectEntry[]
  /** The entries the search leaves, in the same order. Is `entries` itself while the search is empty. */
  readonly visible: readonly ProjectEntry[]
  readonly query: string
  /** Always one of `visible`, or `undefined` when nothing is shown. */
  readonly selected: string | undefined
  /** The action in progress; while it is set, another action is ignored. */
  readonly busy: Busy | undefined
  /** Why the list is unavailable. */
  readonly message: string | undefined
}

export interface HomeController {
  readonly state: { subscribe(run: (state: HomeState) => void): () => void }
  /** Reads the workspace again. The list stays on screen while it loads; an older read never replaces a newer one. */
  refresh(): Promise<void>
  search(query: string): void
  /** Selects a project that is shown; anything else is ignored. */
  select(path: string): void
  step(key: StepKey): void
  /** Opens `path`, or the selected project; `as` is the profile the person chose for a file two profiles claim. */
  open(path?: string, as?: string): Promise<void>
  create(profileId: string, templateId: string): Promise<void>
  /** Copies the selected project and selects the copy. */
  duplicate(): Promise<void>
  /** Deletes the selected project and moves the selection to its neighbour. */
  remove(): Promise<void>
  importFiles(files: readonly { readonly name: string; readonly bytes: Uint8Array }[]): Promise<void>
}

export interface HomeControllerOptions {
  readonly app: EditorApp
  readonly toasts: ToastStore
  /** A document opened (from Open or from New): the owner takes the person to it. */
  onOpened(opened: Extract<OpenOutcome, { readonly status: 'opened' }>): void
  /** A file that needs looking at (the error panel) or a choice of profile: the owner shows it over Home. */
  onProblem(outcome: PanelOutcome | ChoiceOutcome): void
}

export function createHomeController(options: HomeControllerOptions): HomeController {
  const { app, toasts, onOpened, onProblem } = options
  let state: HomeState = {
    phase: 'loading',
    entries: [],
    visible: [],
    query: '',
    selected: undefined,
    busy: undefined,
    message: undefined,
  }
  const listeners = new Set<(state: HomeState) => void>()
  const set = (patch: Partial<HomeState>): void => {
    state = { ...state, ...patch }
    for (const run of listeners) run(state)
  }
  const say = (kind: ToastKind, message: string): void => {
    toasts.push({ kind, message })
  }

  let generation = 0
  /**
   * Lists the workspace and settles the selection: `prefer` may pick one of the new `visible` entries (the copy that was
   * just made, the neighbour of the project that was deleted); otherwise the selection is kept while it shows.
   */
  async function load(prefer?: (visible: readonly ProjectEntry[]) => string | undefined): Promise<void> {
    const mine = ++generation
    if (state.phase === 'unavailable') set({ phase: 'loading', message: undefined })
    try {
      const entries = await app.list()
      if (mine !== generation) return
      const visible = filterProjects(entries, state.query)
      const selected = prefer?.(visible) ?? reconcileSelection(visible, state.selected)
      // No `message` here: a load that is still current began after the last failure, so it cleared the message already.
      set({ phase: 'ready', entries, visible, selected })
    } catch (error) {
      if (mine !== generation) return
      set({
        phase: 'unavailable',
        entries: [],
        visible: [],
        selected: undefined,
        message: classifyStorageError(error).message,
      })
    }
  }

  /** One action at a time: the controls are disabled while `busy`, and a second call that gets through is ignored. */
  async function run(kind: Busy, work: () => Promise<void>): Promise<void> {
    if (state.busy !== undefined) return
    set({ busy: kind })
    try {
      await work()
    } catch (error) {
      say('error', `Something went wrong: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      set({ busy: undefined })
    }
  }

  /**
   * A document opens and its owner takes over. A file to look at or to choose a profile for goes to the owner too (plan
   * ED2D.4c2b, decision 1); a missing file or a store that refused is a toast. Either way the list is read again.
   */
  async function settleOpen(outcome: OpenOutcome): Promise<void> {
    if (outcome.status === 'opened') {
      onOpened(outcome)
      return
    }
    if (needsPanel(outcome) || outcome.status === 'choose') onProblem(outcome)
    else say('error', openProblem(outcome))
    await load()
  }

  return {
    state: {
      subscribe(run) {
        listeners.add(run)
        run(state)
        return () => {
          listeners.delete(run)
        }
      },
    },
    refresh: () => load(),
    search(query) {
      const visible = filterProjects(state.entries, query)
      set({ query, visible, selected: reconcileSelection(visible, state.selected) })
    },
    select(path) {
      if (state.visible.some((entry) => entry.path === path)) set({ selected: path })
    },
    step(key) {
      set({ selected: stepSelection(state.visible, state.selected, key) })
    },
    async open(path, as) {
      const target = path ?? state.selected
      if (target === undefined) return
      await run('open', async () => {
        if (state.visible.some((entry) => entry.path === target)) set({ selected: target })
        await settleOpen(await app.open(target, as))
      })
    },
    create: (profileId, templateId) =>
      run('create', async () => settleOpen(await app.create(profileId, templateId))),
    async duplicate() {
      const target = state.selected
      if (target === undefined) return
      await run('duplicate', async () => {
        const outcome = await app.duplicate(target)
        const notice = duplicateMessage(target, outcome)
        say(notice.kind, notice.text)
        await load((visible) =>
          outcome.status === 'copied' && visible.some((entry) => entry.path === outcome.path)
            ? outcome.path
            : undefined,
        )
      })
    },
    async remove() {
      const target = state.selected
      if (target === undefined) return
      const at = state.visible.findIndex((entry) => entry.path === target)
      await run('remove', async () => {
        await app.remove(target)
        const notice = removeMessage(target)
        say(notice.kind, notice.text)
        await load((visible) => visible[Math.min(at, visible.length - 1)]?.path)
      })
    },
    async importFiles(files) {
      if (files.length === 0) return
      await run('import', async () => {
        const outcomes: ImportOutcome[] = []
        for (const file of files) outcomes.push(await app.importFile(file.name, file.bytes))
        for (const notice of importNotices(outcomes)) say(notice.kind, notice.text)
        const kept = outcomes.findLast((outcome) => outcome.status === 'imported')
        await load((visible) =>
          kept?.status === 'imported' && visible.some((entry) => entry.path === kept.path)
            ? kept.path
            : undefined,
        )
      })
    },
  }
}
