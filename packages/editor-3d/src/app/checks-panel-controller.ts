// The checks panel as plain TypeScript (ED3D.10a, ED3D spec §5.3 flow 7 and §7): it runs the profile's checks after a
// committed step, off the pointer path, and keeps what the checks pill and the problems list show. No Svelte, DOM or
// clock in here: the timer is the app's to hand in, so a test fires it and nothing waits.
//
// The checks run on committed levels only. The history's `revision` moves on an edit, an undo, a redo and a commit and
// not on the live updates of a drag, so a drag in flight never reaches the pill, and the level a run reads is the one
// the step left, whatever has been dragged since.

import type { Point } from '@automata/3d/level'
import type { CheckResult, Locator } from '../checks/check'
import type { LevelEditor } from '../model/level-editor'
import { parseSelection } from '../model/selection-ref'
import { problemCount } from './problem-count'

/** Calls `run` after `delayMs`; the function it returns cancels the call. */
export type Scheduler = (delayMs: number, run: () => void) => () => void

export interface ChecksPanelOptions {
  readonly schedule: Scheduler
  /** The pause between a committed step and the run it asks for; another step inside it restarts it. Default 250. */
  readonly delayMs?: number | undefined
}

export interface ChecksPanelView {
  readonly results: readonly CheckResult[]
  /** The problems of failing checks of severity `error`. */
  readonly errors: number
  /** The problems of failing checks of severity `warning`. */
  readonly warnings: number
  /** A run is waiting for the editing to pause, so the results and counts describe an earlier step. */
  readonly pending: boolean
}

export type LocateResult = { readonly ok: true } | { readonly ok: false; readonly reason: string }

export interface ChecksPanel {
  readonly view: ChecksPanelView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  /** Runs the checks now on the level as last committed, and drops the run that was waiting. */
  run(): void
  /**
   * Selects the place of a problem and centres the plan camera on it, keeping the zoom and the mode: on the locator's
   * point, else on the middle of the sector or the wall it names. Refused, with a sentence and nothing changed, when
   * there is no place or the room or wall is no longer in the level (the results are one step old).
   */
  locate(place: Locator | undefined): LocateResult
  /** Stops following the editor and cancels the run that was waiting. */
  dispose(): void
}

const DEFAULT_DELAY_MS = 250

const refused = (reason: string): LocateResult => ({ ok: false, reason })
const gone = (what: string): LocateResult => refused(`${what} is not in the level any more`)

/** The middle of the box around some corners. */
function middleOf(corners: readonly (readonly [number, number, ...unknown[]])[]): Point {
  const xs = corners.map(([x]) => x)
  const zs = corners.map(([, z]) => z)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
}

/** Equal as data: a result is a few sentences. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

export function createChecksPanel<D>(editor: LevelEditor<D>, options: ChecksPanelOptions): ChecksPanel {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS
  const listeners = new Set<() => void>()
  /** The level as the last committed step left it. */
  let committed = editor.level
  let revision = editor.history.revision
  let cancelWaiting: (() => void) | undefined
  let disposed = false

  const check = (): readonly CheckResult[] => editor.profile.checks(committed)

  const viewOf = (results: readonly CheckResult[], pending: boolean): ChecksPanelView => ({
    results,
    errors: problemCount(results, 'error'),
    warnings: problemCount(results, 'warning'),
    pending,
  })

  let view = viewOf(check(), false)

  /** Shows these results; the same view, and nobody told, when nothing differs. */
  const show = (results: readonly CheckResult[], pending: boolean): void => {
    const kept = same(results, view.results) ? view.results : results
    if (kept === view.results && pending === view.pending) return
    view = viewOf(kept, pending)
    for (const run of [...listeners]) run()
  }

  const drop = (): void => {
    cancelWaiting?.()
    cancelWaiting = undefined
  }

  const refresh = (): void => {
    drop()
    show(check(), false)
  }

  const stop = editor.history.subscribe((history) => {
    if (history.revision === revision) return
    revision = history.revision
    committed = editor.level
    drop()
    cancelWaiting = options.schedule(delayMs, () => {
      if (disposed) return
      refresh()
    })
    show(view.results, true)
  })

  return {
    get view() {
      return view
    },
    subscribe(run) {
      listeners.add(run)
      return () => {
        listeners.delete(run)
      }
    },
    run: refresh,
    locate(place) {
      if (place === undefined) return refused('that problem has no place in the level')
      const ref = parseSelection(place.selection)
      if (ref === undefined) return refused(`${JSON.stringify(place.selection)} is not a place in the level`)
      // An entity is not in the sector list: the entity model arrives with ED3D.7, so it is selected and framed by its point.
      let middle: Point | undefined
      if (ref.kind !== 'entity') {
        const sector = editor.profile.sectors.list(editor.level).find((each) => each.id === ref.sector)
        if (sector === undefined) return gone(ref.sector)
        if (ref.kind === 'sector') middle = middleOf(sector.corners)
        else {
          const from = sector.corners[ref.corner]
          if (from === undefined) return gone(`wall ${ref.corner} of ${ref.sector}`)
          // The last wall of an outline runs on to the first corner.
          const to = sector.corners[(ref.corner + 1) % sector.corners.length] ?? from
          middle = middleOf([from, to])
        }
      }
      const at = place.at ?? middle
      editor.selection.set([place.selection])
      if (at !== undefined) editor.view.set({ camera: { ...editor.view.state.camera, x: at.x, z: at.z } })
      return { ok: true }
    },
    dispose() {
      disposed = true
      drop()
      stop()
      listeners.clear()
    },
  }
}
