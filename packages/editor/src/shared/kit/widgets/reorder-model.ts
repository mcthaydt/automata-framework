// The arithmetic of a reorderable list, without a DOM: which place a pointer is over, how locked
// rows constrain the answer, how the other rows shift to make room, and how fast to scroll near an edge.
//
// A "place" is an index in the list. Locked rows never change place: the unlocked rows permute among the unlocked
// places, so a row dropped "at" place 3 is at index 3 afterwards, whatever sits between.

export interface RowShape {
  readonly height: number
  readonly locked: boolean
}

/**
 * The unlocked place nearest `index`. A tie goes to the side `from` is on, so the row moves less. When no place is
 * unlocked the row stays at `from`.
 */
export function nearestUnlocked(locked: readonly boolean[], index: number, from: number): number {
  if (locked[index] === false) return index
  for (let distance = 1; distance < locked.length; distance++) {
    const lower = index - distance
    const upper = index + distance
    const lowerFree = lower >= 0 && locked[lower] === false
    const upperFree = upper < locked.length && locked[upper] === false
    if (lowerFree && upperFree) return from <= index ? lower : upper
    if (lowerFree) return lower
    if (upperFree) return upper
  }
  return from
}

/** The place whose row spans `y` (list coordinates, rows from the top), moved off a locked row. */
export function targetIndex(rows: readonly RowShape[], y: number, from: number): number {
  let top = 0
  let index = rows.length - 1
  for (let i = 0; i < rows.length; i++) {
    top += rows[i]?.height ?? 0
    if (y < top) {
      index = i
      break
    }
  }
  return nearestUnlocked(
    rows.map((row) => row.locked),
    Math.max(0, index),
    from,
  )
}

/**
 * The list after moving the row at `from` to place `to`, locked rows staying put. Unlocked rows between the two
 * places each shift by one unlocked place. A locked row cannot be moved, so `from` on one returns a copy.
 */
export function moveRow<T>(
  items: readonly T[],
  isLocked: (item: T) => boolean,
  from: number,
  to: number,
): T[] {
  const moved = items[from]
  if (moved === undefined || isLocked(moved)) return [...items]
  const unlocked = items.filter((item) => !isLocked(item))
  const rank = (place: number): number => items.slice(0, place).filter((item) => !isLocked(item)).length
  unlocked.splice(rank(from), 1)
  unlocked.splice(rank(to), 0, moved)
  let next = 0
  return items.map((item) => (isLocked(item) ? item : (unlocked[next++] as T)))
}

/** The next unlocked place from `from` in `direction`; `from` itself at the end of the list or before only locked rows. */
export function stepTarget(locked: readonly boolean[], from: number, direction: 1 | -1): number {
  for (let place = from + direction; place >= 0 && place < locked.length; place += direction) {
    if (locked[place] === false) return place
  }
  return from
}

export interface AutoScrollOptions {
  /** How close to an edge scrolling starts, in pixels. Default 48. */
  readonly edge?: number
  /** Pixels per frame at the edge. Default 18. */
  readonly maxSpeed?: number
}

/**
 * Pixels to scroll this frame, negative upward: zero outside the two edge zones, rising to `maxSpeed` at the edge and
 * beyond it. The zone is never more than half the area, so a short list has a top half and a bottom half.
 */
export function autoScrollSpeed(
  pointerY: number,
  top: number,
  bottom: number,
  options: AutoScrollOptions = {},
): number {
  const maxSpeed = options.maxSpeed ?? 18
  const edge = Math.min(options.edge ?? 48, (bottom - top) / 2)
  if (edge <= 0) return 0
  const intoTop = (top + edge - pointerY) / edge
  if (intoTop > 0) return -maxSpeed * Math.min(1, intoTop)
  const intoBottom = (pointerY - (bottom - edge)) / edge
  if (intoBottom > 0) return maxSpeed * Math.min(1, intoBottom)
  return 0
}

/**
 * How far each row moves when the rows are laid out in `order` (a permutation of the original indices), by original
 * index: the preview of a drop, drawn as a translate so no row leaves the DOM.
 */
export function rowOffsets(heights: readonly number[], order: readonly number[]): number[] {
  const before: number[] = []
  let top = 0
  for (const height of heights) {
    before.push(top)
    top += height
  }
  const offsets = heights.map(() => 0)
  let placed = 0
  for (const original of order) {
    offsets[original] = placed - (before[original] ?? 0)
    placed += heights[original] ?? 0
  }
  return offsets
}
