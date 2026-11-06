// The title's slot list as the screen keeps it: the runtime's `SlotState`s as the ui's `SaveSlotView`s,
// with the activity only this screen knows. The model is a `$state` object the screen changes in place, so a slot
// changing on the host never remounts the list.

import type { SlotState } from '../../../features/saves/save.schema.ts'
import type { SaveStatusState } from '../../../shared/ui/status/save-status.ts'
import type { SaveSlotActivity, SaveSlotsView, SaveSlotView } from './save-slots.ts'

/** One slot as the list shows it, from what the runtime says it holds. */
export function slotViewOf(state: SlotState, activity?: SaveSlotActivity): SaveSlotView {
  const mark = activity === undefined ? {} : { activity }
  switch (state.kind) {
    case 'ready':
    case 'other-content':
      return {
        kind: state.kind,
        slot: state.slot,
        savedAt: state.meta.savedAt,
        ...(state.meta.label === undefined ? {} : { label: state.meta.label }),
        ...mark,
      }
    case 'empty':
    case 'unreadable':
    case 'newer':
      return { kind: state.kind, slot: state.slot, ...mark }
  }
}

export interface SlotsModel {
  /** Loading until the first list arrives. */
  readonly view: SaveSlotsView
  /** The runtime's current slots; a mark on a slot from an earlier list is dropped. */
  set(states: readonly SlotState[]): void
  /** A write this screen started on `slot`, or that failed; undefined clears it. */
  mark(slot: number, activity: SaveSlotActivity | undefined): void
}

export function createSlotsModel(): SlotsModel {
  const model = $state<{ states: readonly SlotState[] | undefined; marks: Record<number, SaveSlotActivity> }>(
    {
      states: undefined,
      marks: {},
    },
  )
  return {
    get view(): SaveSlotsView {
      const states = model.states
      if (states === undefined) return { state: 'loading' }
      return { state: 'slots', slots: states.map((state) => slotViewOf(state, model.marks[state.slot])) }
    },
    set(states) {
      model.states = states
      model.marks = {}
    },
    mark(slot, activity) {
      if (model.states?.some((state) => state.slot === slot) !== true) return
      const { [slot]: _gone, ...rest } = model.marks
      model.marks = activity === undefined ? rest : { ...rest, [slot]: activity }
    },
  }
}

/** What the paused screen says about the save, changed in place so the host changing its mind never remounts it. */
export interface PausedSavesView {
  /** The host's state, or undefined where there is nothing to say (standalone). */
  status: SaveStatusState | undefined
  /** Another device changed the slot being played: the choice is on offer. */
  changedElsewhere: boolean
  /** Load newer was chosen and the other device's progress could not be used. */
  loadFailed: boolean
}

export function createPausedSavesView(): PausedSavesView {
  const view = $state<PausedSavesView>({ status: undefined, changedElsewhere: false, loadFailed: false })
  return view
}
