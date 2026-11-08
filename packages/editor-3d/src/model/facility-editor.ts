// The facility editor (ED3D.9a, ED3D spec §4.2 and §5.3 flow 6): the kit's `History` over `facility.json` and a
// `Selection` of World ids, behind one object, and the one way a change gets in. It follows `LevelEditor` and differs
// in two things: the facility is a file apart from every level, so it has a history of its own (the kit's storage keeps
// the known mtime, the journal and the dirty mark per document), and it has no profile, since a facility has one format.
import {
  createHistory,
  createSelection,
  type History,
  HistoryError,
  type Selection,
  type Transaction,
} from '@mcthaydt/automata-editor/kit/core'
import type { Facility } from '../format/facility.schema'
import { type EditResult, refuse } from './edit'
import { parseFacilitySelection } from './facility-selection'

/** What an edit of the facility is: the level editor's protocol, without a profile. The new facility is the result's `level`. */
export interface FacilityEdit {
  /** The command's name in spec §5.4: `wing.move`. */
  readonly id: string
  /** The undo label: `Move wing bay`. */
  readonly label: string
  /** Two runs with this key close together are one undo step (nudging one number). */
  readonly coalesce?: string | undefined
  run(facility: Facility): EditResult<Facility>
}

/** What the `History` holds. A member, not the bare facility, so a second one can join it without changing the type's users. */
export interface FacilityState {
  readonly facility: Facility
}

export interface FacilitySession {
  /** False once it was committed, cancelled, or cancelled by an undo; a closed session refuses every run. */
  readonly open: boolean
  run(edit: FacilityEdit): EditResult<Facility>
  commit(): void
  cancel(): void
}

export interface FacilityEditor {
  readonly history: History<FacilityState>
  readonly selection: Selection<string>
  /** The live facility, including the runs of an open session. */
  readonly facility: Facility
  /** Applies an edit as one undo step. A refusal changes nothing; so does an edit that leaves the facility as it was. */
  run(edit: FacilityEdit): EditResult<Facility>
  /** Opens a session. When another is already open the session comes back closed and refuses its runs. */
  begin(label: string): FacilitySession
}

export interface FacilityEditorOptions {
  readonly facility: Facility
  /** Milliseconds, for the history's coalescing window: the clock is the app's to inject. */
  readonly now?: (() => number) | undefined
}

export function createFacilityEditor(options: FacilityEditorOptions): FacilityEditor {
  const history = createHistory<FacilityState>(
    { facility: options.facility },
    options.now === undefined ? {} : { now: options.now },
  )
  const selection = createSelection<string>()

  /** Drops the World ids the live facility no longer has. An id of another kind is not its to judge. */
  const reconcile = (): void => {
    const { facility } = history.state
    const present = {
      wing: new Set(facility.wings.map((wing) => wing.id)),
      join: new Set(facility.joins.map((join) => join.id)),
      lock: new Set(facility.locks.map((lock) => lock.id)),
      phase: new Set(facility.phases.map((phase) => phase.id)),
    }
    selection.set(
      selection.ids.filter((id) => {
        const ref = parseFacilitySelection(id)
        return ref === undefined || present[ref.kind].has(ref.id)
      }),
    )
  }
  history.subscribe(reconcile)

  const closed = (reason: string): FacilitySession => ({
    open: false,
    run: () => refuse(reason),
    commit: () => {},
    cancel: () => {},
  })

  const select = (result: { readonly select?: readonly string[] | undefined }): void => {
    if (result.select !== undefined) selection.set(result.select)
  }

  return {
    history,
    selection,
    get facility() {
      return history.state.facility
    },
    run(edit) {
      const result = edit.run(history.state.facility)
      if (!result.ok) return result
      try {
        history.apply(
          edit.label,
          (state) => (result.level === state.facility ? state : { facility: result.level }),
          edit.coalesce === undefined ? undefined : { coalesce: edit.coalesce },
        )
      } catch (error) {
        if (error instanceof HistoryError) return refuse(error.message)
        throw error
      }
      select(result)
      return result
    },
    begin(label) {
      let transaction: Transaction<FacilityState>
      try {
        transaction = history.begin(label)
      } catch (error) {
        if (error instanceof HistoryError) return closed(error.message)
        throw error
      }
      return {
        get open() {
          return transaction.open
        },
        run(edit) {
          if (!transaction.open) return refuse(`the edit "${label}" is over`)
          const result = edit.run(history.state.facility)
          if (!result.ok) return result
          transaction.update((state) =>
            result.level === state.facility ? state : { facility: result.level },
          )
          select(result)
          return result
        },
        commit: () => transaction.commit(),
        cancel: () => transaction.cancel(),
      }
    },
  }
}
