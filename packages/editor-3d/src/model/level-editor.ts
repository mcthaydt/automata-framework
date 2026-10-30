// The level editor (ED3D spec §4.2): the kit's `History` over the level, a `Selection` of selection ids, and the view
// store, behind one object; and the one way a change gets in. `run` applies an edit as a step; `begin` opens a session
// for a drag or a draw, whose runs show live and commit as one step. After any change of the level the selection drops
// the sectors, walls and things that are gone.
import {
  createHistory,
  createSelection,
  type History,
  HistoryError,
  type Selection,
  type Transaction,
} from '@mcthaydt/automata-editor-kit/core'
import type { LevelProfile } from '../profile/level-profile'
import type { EditSector } from '../profile/sector-access'
import { type Edit, type EditResult, refuse } from './edit'
import type { LevelState } from './level-state'
import { parseSelection } from './selection-ref'
import { createViewStore, type ViewStore } from './view-store'

export interface EditSession<D> {
  /** False once it was committed, cancelled, or cancelled by an undo; a closed session refuses every run. */
  readonly open: boolean
  run(edit: Edit<D>): EditResult<D>
  commit(): void
  cancel(): void
}

export interface LevelEditor<D> {
  readonly profile: LevelProfile<D>
  readonly history: History<LevelState<D>>
  readonly selection: Selection<string>
  readonly view: ViewStore
  /** The live level, including the runs of an open session. */
  readonly level: D
  /** Applies an edit as one undo step. A refusal changes nothing; so does an edit that leaves the level as it was. */
  run(edit: Edit<D>): EditResult<D>
  /** Opens a session. When another is already open the session comes back closed and refuses its runs. */
  begin(label: string): EditSession<D>
}

export interface LevelEditorOptions<D> {
  readonly profile: LevelProfile<D>
  readonly level: D
  /** Milliseconds, for the history's coalescing window: the clock is the app's to inject. */
  readonly now?: (() => number) | undefined
}

/** `compute`, run the first time it is asked for and not again. */
function once<T>(compute: () => T): () => T {
  let held: { readonly value: T } | undefined
  return () => {
    held ??= { value: compute() }
    return held.value
  }
}

export function createLevelEditor<D>(options: LevelEditorOptions<D>): LevelEditor<D> {
  const { profile } = options
  const history = createHistory<LevelState<D>>(
    { level: options.level },
    options.now === undefined ? {} : { now: options.now },
  )
  const selection = createSelection<string>()
  const view = createViewStore()

  /**
   * Drops the sector, wall and thing ids the live level no longer has. A thing the reader could not read is still there
   * (Locate may have selected it); a thing of a kind the level has no definition for and an id of a kind it does not know
   * are not its to judge.
   */
  const reconcile = (): void => {
    const level = history.state.level
    const sectors = new Map<string, EditSector>(
      profile.sectors.list(level).map((sector) => [sector.id, sector]),
    )
    const things = once(() => {
      const kit = profile.entities(level)
      return {
        definitions: new Set(kit.definitions.map((definition) => definition.id)),
        held: new Set(
          [...kit.things, ...kit.problems.flatMap((problem) => problem.entity ?? [])].map(
            (thing) => `${thing.def}/${thing.id}`,
          ),
        ),
      }
    })
    const gone = (id: string): boolean => {
      const ref = parseSelection(id)
      if (ref?.kind === 'sector') return !sectors.has(ref.sector)
      if (ref?.kind === 'wall') return (sectors.get(ref.sector)?.corners.length ?? 0) <= ref.corner
      if (ref?.kind === 'entity') {
        const { definitions, held } = things()
        return definitions.has(ref.definition) && !held.has(`${ref.definition}/${ref.id}`)
      }
      return false
    }
    selection.set(selection.ids.filter((id) => !gone(id)))
  }
  history.subscribe(reconcile)

  const closed = (reason: string): EditSession<D> => ({
    open: false,
    run: () => refuse(reason),
    commit: () => {},
    cancel: () => {},
  })

  const select = (result: EditResult<D>): void => {
    if (result.ok && result.select !== undefined) selection.set(result.select)
  }

  return {
    profile,
    history,
    selection,
    view,
    get level() {
      return history.state.level
    },
    run(edit) {
      const result = edit.run(profile, history.state.level)
      if (!result.ok) return result
      try {
        history.apply(
          edit.label,
          (state) => (result.level === state.level ? state : { level: result.level }),
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
      let transaction: Transaction<LevelState<D>>
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
          const result = edit.run(profile, history.state.level)
          if (!result.ok) return result
          transaction.update((state) => (result.level === state.level ? state : { level: result.level }))
          select(result)
          return result
        },
        commit: () => transaction.commit(),
        cancel: () => transaction.cancel(),
      }
    },
  }
}
