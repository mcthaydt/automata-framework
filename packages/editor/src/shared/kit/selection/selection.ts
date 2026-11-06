// The set of selected ids with a primary one. Every change gives a new object, so a view can compare by identity.
export type SelectionId = string | number

export interface Selection<Id extends SelectionId> {
  /** In selection order; the same array until the selection changes, so a consumer can compare by identity. */
  readonly ids: readonly Id[]
  readonly size: number
  /** The most recently selected id: the one an inspector shows. */
  readonly primary: Id | undefined
  has(id: Id): boolean
  /** Replaces the selection; the last id becomes the primary. */
  set(ids: Iterable<Id>): void
  /** An id already selected becomes the primary. */
  add(id: Id): void
  toggle(id: Id): void
  clear(): void
  /**
   * Replaces the selection with the ids from `from` to `to` in `order` (either direction); the primary is `to`.
   * An end that is not in `order` changes nothing: a stale id from a document that just changed is not an error.
   */
  range(from: Id, to: Id, order: readonly Id[]): void
  subscribe(listener: (selection: Selection<Id>) => void): () => void
}

/**
 * The editor's selection. Ids are the document's own (strings or numbers) and order is the caller's: the
 * kit knows nothing about the document, so removing a selected item is the editor's `set` call.
 */
export function createSelection<Id extends SelectionId>(): Selection<Id> {
  let ids: readonly Id[] = []
  const listeners = new Set<(selection: Selection<Id>) => void>()

  const replace = (next: readonly Id[]): void => {
    const same = next.length === ids.length && next.every((id, index) => id === ids[index])
    if (same) return
    ids = next
    for (const listener of [...listeners]) listener(selection)
  }

  const selection: Selection<Id> = {
    get ids() {
      return ids
    },
    get size() {
      return ids.length
    },
    get primary() {
      return ids[ids.length - 1]
    },
    has: (id) => ids.includes(id),
    set: (next) => replace([...new Set(next)]),
    add: (id) => replace([...ids.filter((each) => each !== id), id]),
    toggle: (id) => replace(ids.includes(id) ? ids.filter((each) => each !== id) : [...ids, id]),
    clear: () => replace([]),
    range(from, to, order) {
      const start = order.indexOf(from)
      const end = order.indexOf(to)
      if (start < 0 || end < 0) return
      replace(start <= end ? order.slice(start, end + 1) : order.slice(end, start + 1).reverse())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return selection
}
