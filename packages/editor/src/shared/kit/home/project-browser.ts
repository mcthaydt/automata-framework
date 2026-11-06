import { classifyStorageError } from '../storage/project-store'
import { filterEntries, reconcileSelection, type StepKey, stepSelection } from './project-browse'

// The state machine behind a Home's project list (moved from editor-2d's `home-controller.ts` in ED3D.5c; plan
// ED2D.4c2a, decision 1): what the list shows, what is selected, which action is running. An editor's Home controller
// adds its own actions on top, each through `run`, and reads the list again with `refresh`. It draws nothing and follows
// the Svelte store contract (`state.subscribe`), so a component reads it as `$state` and a Node test reads it directly.

export interface BrowserState<E, B extends string = string> {
  /** `loading` until the first listing; `unavailable` when the workspace cannot be listed. */
  readonly phase: 'loading' | 'ready' | 'unavailable'
  /** Every project, in the editor's order. */
  readonly entries: readonly E[]
  /** The entries the search leaves, in the same order. Is `entries` itself while the search is empty. */
  readonly visible: readonly E[]
  readonly query: string
  /** Always one of `visible`, or `undefined` when nothing is shown. */
  readonly selected: string | undefined
  /** The action in progress; while it is set, another action is ignored. */
  readonly busy: B | undefined
  /** Why the list is unavailable. */
  readonly message: string | undefined
}

/** What a Home screen reads and drives: the list's state and the moves within it. */
export interface ProjectListSource<E, B extends string = string> {
  readonly state: { subscribe(run: (state: BrowserState<E, B>) => void): () => void }
  /** Reads the workspace again. The list stays on screen while it loads; an older read never replaces a newer one. */
  refresh(): Promise<void>
  search(query: string): void
  /** Selects a project that is shown; anything else is ignored. */
  select(path: string): void
  step(key: StepKey): void
}

export interface ProjectBrowser<E, B extends string = string> extends ProjectListSource<E, B> {
  /** The state right now. */
  readonly current: BrowserState<E, B>
  /**
   * Lists the workspace and settles the selection: `prefer` may pick one of the new `visible` entries (the copy that was
   * just made, the file just imported); otherwise the selection is kept while it shows.
   */
  load(prefer?: (visible: readonly E[]) => string | undefined): Promise<void>
  /** One action at a time: a call while another runs is ignored. A throw is told through `onError`. */
  run(kind: B, work: () => Promise<void>): Promise<void>
}

export interface ProjectBrowserOptions<E extends { readonly path: string }> {
  list(): Promise<readonly E[]>
  /** What a search looks through for an entry (`cardWords` of its card, or the same words without the colours). */
  words(entry: E): readonly string[]
  /** An action threw: the words for a toast. */
  onError(message: string): void
}

export function createProjectBrowser<E extends { readonly path: string }, B extends string = string>(
  options: ProjectBrowserOptions<E>,
): ProjectBrowser<E, B> {
  const { list, words, onError } = options
  let state: BrowserState<E, B> = {
    phase: 'loading',
    entries: [],
    visible: [],
    query: '',
    selected: undefined,
    busy: undefined,
    message: undefined,
  }
  const listeners = new Set<(state: BrowserState<E, B>) => void>()
  const set = (patch: Partial<BrowserState<E, B>>): void => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener(state)
  }

  let generation = 0
  async function load(prefer?: (visible: readonly E[]) => string | undefined): Promise<void> {
    const mine = ++generation
    if (state.phase === 'unavailable') set({ phase: 'loading', message: undefined })
    try {
      const entries = await list()
      if (mine !== generation) return
      const visible = filterEntries(entries, state.query, words)
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

  return {
    get current() {
      return state
    },
    state: {
      subscribe(listener) {
        listeners.add(listener)
        listener(state)
        return () => {
          listeners.delete(listener)
        }
      },
    },
    load,
    refresh: () => load(),
    search(query) {
      const visible = filterEntries(state.entries, query, words)
      set({ query, visible, selected: reconcileSelection(visible, state.selected) })
    },
    select(path) {
      if (state.visible.some((entry) => entry.path === path)) set({ selected: path })
    },
    step(key) {
      set({ selected: stepSelection(state.visible, state.selected, key) })
    },
    async run(kind, work) {
      if (state.busy !== undefined) return
      set({ busy: kind })
      try {
        await work()
      } catch (error) {
        onError(`Something went wrong: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        set({ busy: undefined })
      }
    },
  }
}
