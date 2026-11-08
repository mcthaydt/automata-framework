// The SaveSlots list's contract. The slot kinds are the runtime's `SlotState`, typed here because ui
// does not depend on the runtime; the runtime's value fits it once the caller adds `activity`, which only the caller
// knows (a write it started and has not finished, or one that failed).

/** A write the caller has started and not finished, or one that failed. */
export type SaveSlotActivity = 'writing' | 'failed'

/** One slot, as the list shows it. `savedAt` is a time in milliseconds, kept as the header says. */
export type SaveSlotView =
  | { readonly kind: 'empty'; readonly slot: number; readonly activity?: SaveSlotActivity }
  | {
      readonly kind: 'ready' | 'other-content'
      readonly slot: number
      readonly savedAt: number
      readonly label?: string
      readonly activity?: SaveSlotActivity
    }
  | { readonly kind: 'unreadable'; readonly slot: number; readonly activity?: SaveSlotActivity }
  | { readonly kind: 'newer'; readonly slot: number; readonly activity?: SaveSlotActivity }

/** What the list shows: a moment of loading, or the slots. */
export type SaveSlotsView =
  | { readonly state: 'loading' }
  | { readonly state: 'slots'; readonly slots: readonly SaveSlotView[] }

/** Every word the list shows, in the game's language (each a message key). */
export interface SaveSlotsCopy {
  /** The list's accessible name. */
  readonly title: string
  readonly loading: string
  /** "Slot 3": a slot with no label of its own. */
  readonly slot: (slot: number) => string
  readonly empty: string
  /** `unreadable`: "This save can't be opened". */
  readonly unreadable: string
  /** `newer`: "Saved by a newer version of the game". */
  readonly newer: string
  /** `other-content`: saved with other game content; its progress loads, its snapshot does not. */
  readonly otherContent: string
  readonly writing: string
  readonly failed: string
  /** Continue the chosen slot. */
  readonly load: string
  readonly newGame: string
  /** The action that opens the question, with its ellipsis. */
  readonly delete: string
  readonly deleteTitle: string
  /** The question's text; `name` is the slot's label or its "Slot N". */
  readonly deleteBody: (name: string) => string
  /** The question's text for a slot a newer build made. */
  readonly deleteNewerBody: string
  /** The confirming button. */
  readonly deleteConfirm: string
  /** The safe button, which takes focus. */
  readonly cancel: string
  /** "+N more", for the rows below the fold. */
  readonly more: (count: number) => string
}

/** The newest slot that can be continued; else the first slot; else none. */
export function defaultSlot(slots: readonly SaveSlotView[]): number | undefined {
  let newest: { slot: number; savedAt: number } | undefined
  for (const slot of slots) {
    if (slot.kind !== 'ready' && slot.kind !== 'other-content') continue
    if (newest === undefined || slot.savedAt > newest.savedAt)
      newest = { slot: slot.slot, savedAt: slot.savedAt }
  }
  return newest?.slot ?? slots[0]?.slot
}

/**
 * What a player may do with a slot. A slot that cannot be opened, or that a newer build made, can only be
 * deleted: writing over it is two steps, delete then New game, so it is never one tap.
 */
export function slotActionsOf(slot: SaveSlotView): {
  readonly load: boolean
  readonly newGame: boolean
  readonly remove: boolean
} {
  switch (slot.kind) {
    case 'empty':
      return { load: false, newGame: true, remove: false }
    case 'ready':
    case 'other-content':
      return { load: true, newGame: false, remove: true }
    case 'unreadable':
    case 'newer':
      return { load: false, newGame: false, remove: true }
  }
}
