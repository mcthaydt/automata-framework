// The editor's view state (ED3D spec §4.2): mode, the layer the tools work on, hidden and locked layers, camera and
// grid. Only the level is saved and only the level is undone, so this lives beside the History and a change of it is
// never a step. It is plain data and a listener list; the views read `state` and redraw when told.
export type ViewMode = 'plan' | 'split' | 'dollhouse' | 'walk' | 'world'

export interface ViewState {
  readonly mode: ViewMode
  /** The layer new work goes on and the inspector follows: `sectors`, `walls` or `things:<definition>`. */
  readonly layer: string
  /** Layers that are not drawn and not hit. */
  readonly hidden: readonly string[]
  /** Layers that are drawn and not hit. */
  readonly locked: readonly string[]
  /** The plan's centre in metres and its zoom (1 is the default scale). */
  readonly camera: { readonly x: number; readonly z: number; readonly zoom: number }
  /** The snap grid in metres. */
  readonly grid: { readonly step: number; readonly snap: boolean }
}

/** The sub-layer of the Things layer that holds the instances of one entity definition. */
export const thingLayer = (definition: string): string => `things:${definition}`

export const initialView: ViewState = {
  mode: 'plan',
  layer: 'sectors',
  hidden: [],
  locked: [],
  camera: { x: 0, z: 0, zoom: 1 },
  grid: { step: 0.5, snap: true },
}

export interface ViewStore {
  readonly state: ViewState
  /** Changes the members named; tells the subscribers once, and not at all when nothing differs. */
  set(change: Partial<ViewState>): void
  /** Adds the layer to the list, or takes it off when it is there. */
  toggle(list: 'hidden' | 'locked', layer: string): void
  subscribe(listener: (state: ViewState) => void): () => void
}

/** Equal as data. Two members that differ only in key order count as different: one needless notification, never a missed one. */
const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)

export function createViewStore(initial: Partial<ViewState> = {}): ViewStore {
  let state: ViewState = { ...initialView, ...initial }
  const listeners = new Set<(state: ViewState) => void>()

  const set = (change: Partial<ViewState>): void => {
    const differs = Object.entries(change).some(([key, value]) => !same(value, state[key as keyof ViewState]))
    if (!differs) return
    state = { ...state, ...change }
    for (const listener of [...listeners]) listener(state)
  }

  return {
    get state() {
      return state
    },
    set,
    toggle(list, layer) {
      const current = state[list]
      set({
        [list]: current.includes(layer) ? current.filter((each) => each !== layer) : [...current, layer],
      })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
