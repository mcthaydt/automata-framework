import type { EditHistory } from '../../shared/level-2d/editor/level-editor-api'
import type { Project } from '../../shared/level-2d/model/project-types'

// An `EditHistory` with the kit's `History` semantics for the controller's tests (the kit's own tests cover the real
// one): a transaction's updates show live, a commit is one step and records nothing when the state is the one it
// began with, a cancel restores it, and an `apply` that returns the same project records nothing.

export interface FakeStep {
  readonly label: string
  readonly before: Project
  readonly after: Project
}

export interface FakeHistory extends EditHistory {
  readonly steps: readonly FakeStep[]
  /** Whether a transaction is open. */
  readonly open: boolean
  /** How many transactions were begun, committed or not, so a test can tell "cancelled" from "never started". */
  readonly begun: number
}

export function createFakeHistory(initial: Project): FakeHistory {
  let state = initial
  let open = false
  let begun = 0
  const steps: FakeStep[] = []
  return {
    get state() {
      return state
    },
    get steps() {
      return steps
    },
    get open() {
      return open
    },
    get begun() {
      return begun
    },
    apply(label, update) {
      if (open) throw new Error('a transaction is open')
      const before = state
      const after = update(before)
      if (after === before) return
      state = after
      steps.push({ label, before, after })
    },
    begin(label) {
      if (open) throw new Error('a transaction is already open')
      open = true
      begun += 1
      const before = state
      let live = true
      return {
        update(fn) {
          if (live) state = fn(state)
        },
        commit() {
          if (!live) return
          live = false
          open = false
          if (state !== before) steps.push({ label, before, after: state })
        },
        cancel() {
          if (!live) return
          live = false
          open = false
          state = before
        },
      }
    },
  }
}
