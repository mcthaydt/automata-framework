// The inventory's state, apart from the drawing: which item's sheet is open and whether a combine is waiting for its
// second item. Pressing an item is one function, so what each press does is tested without a DOM.

export interface InventoryState {
  /** The item whose sheet is open. */
  readonly open: string | undefined
  /** The open item is waiting for a second item to combine with. */
  readonly combining: boolean
}

export const CLOSED: InventoryState = { open: undefined, combining: false }

/** What pressing item `id` does: open its sheet, or while combining finish the combine (or cancel it on the same item). */
export function pressItem(
  state: InventoryState,
  id: string,
): { readonly state: InventoryState; readonly combine?: readonly [string, string] } {
  if (state.open !== undefined && state.combining) {
    if (id === state.open) return { state: { open: id, combining: false } }
    return { state: CLOSED, combine: [state.open, id] }
  }
  return { state: { open: id, combining: false } }
}

/** The state when the item list changes: a sheet for an item that is gone closes. */
export const withItems = (state: InventoryState, ids: readonly string[]): InventoryState =>
  state.open !== undefined && !ids.includes(state.open) ? CLOSED : state
