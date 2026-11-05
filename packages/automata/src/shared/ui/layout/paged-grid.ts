/**
 * PagedGrid's page arithmetic.
 *
 * A grid never scrolls: its items sit on pages of a fixed shape, one group per page, so no screen grows with its
 * catalog. The shape is the most the game allows, cut down to what the measured box holds at the smallest tile a
 * finger can hit. A form factor does not say how tall a screen is (a phone held sideways is both 270 and 430 px).
 */

import type { Snippet } from 'svelte'

/** A titled run of items; each group starts its own page. */
export interface PageGroup<T> {
  readonly id: string
  readonly title: string
  readonly items: readonly T[]
}

/** One page: a group's items, padded with `undefined` to the page's capacity. */
export interface GridPage<T> {
  readonly key: string
  readonly groupId: string
  readonly title: string
  readonly slots: readonly (T | undefined)[]
}

/** A page's columns and rows. */
export interface GridShape {
  readonly columns: number
  readonly rows: number
}

/** The measured box a page is fitted into, in CSS px. */
export interface GridBox {
  readonly width: number
  readonly height: number
}

/** PagedGrid's props: groups of items, the most columns and rows a page has, and the page its owner shows. */
export interface PagedGridProps<T> {
  /** The grid's name for assistive technology, also the pager's. */
  label: string
  groups: readonly PageGroup<T>[]
  /** The most columns and rows a page has. */
  most: GridShape
  /** The current page, from 0; wrapped into range. */
  page: number
  onpage: (page: number) => void
  item: Snippet<[T]>
  /** The smallest tile side, in px, before the shape drops a row or column. */
  minTile?: number | undefined
  gap?: number | undefined
  /** How a group's later pages are titled. */
  continued?: ((title: string, part: number) => string) | undefined
  dotLabel?: ((position: number, total: number) => string) | undefined
  testId?: string | undefined
}

/**
 * One group per page; a group longer than a page continues under `continued(title, part)`, "Title (2)" by default.
 * An empty group has no page.
 */
export function paginate<T>(
  groups: readonly PageGroup<T>[],
  capacity: number,
  continued: (title: string, part: number) => string = (title, part) => `${title} (${part})`,
): GridPage<T>[] {
  const size = Math.max(1, capacity)
  const pages: GridPage<T>[] = []
  for (const group of groups) {
    for (let start = 0, part = 1; start < group.items.length; start += size, part += 1) {
      const items = group.items.slice(start, start + size)
      const empty = Array.from({ length: size - items.length }, (): T | undefined => undefined)
      pages.push({
        key: `${group.id}:${part}`,
        groupId: group.id,
        title: part === 1 ? group.title : continued(group.title, part),
        slots: [...items, ...empty],
      })
    }
  }
  return pages
}

const fits = (extent: number, minTile: number, gap: number): number =>
  Math.max(1, Math.floor((extent + gap) / (minTile + gap)))

/** The most tiles of `minTile` px the box holds, never more than `most`, never below one by one. */
export function fitShape(most: GridShape, box: GridBox, minTile: number, gap: number): GridShape {
  return {
    columns: Math.max(1, Math.min(most.columns, fits(box.width, minTile, gap))),
    rows: Math.max(1, Math.min(most.rows, fits(box.height, minTile, gap))),
  }
}

/**
 * A square tile's side for the space a grid is given: the width shared by the columns and the `peek` (a fraction
 * of a tile) of the next page showing at the edge, and the height only when the box has one. A grid laid in a
 * content-sized panel passes an infinite height, because a height measured from its own tiles would only ever
 * confirm the smallest tile. Clamped to `min`..`max`.
 */
export function tileSide(
  shape: GridShape,
  box: GridBox,
  gap: number,
  limits: { readonly peek: number; readonly min: number; readonly max: number },
): number {
  const across = (box.width - gap * (shape.columns - 1)) / (shape.columns + limits.peek)
  const down = Number.isFinite(box.height)
    ? (box.height - gap * (shape.rows - 1)) / shape.rows
    : Number.POSITIVE_INFINITY
  return Math.max(limits.min, Math.min(limits.max, Math.floor(Math.min(across, down))))
}

/** The shape cut to the rows the largest group fills, so no page carries a row of empty slots. */
export function trimRows<T>(shape: GridShape, groups: readonly PageGroup<T>[]): GridShape {
  const largest = Math.max(0, ...groups.map((group) => group.items.length))
  return {
    columns: shape.columns,
    rows: Math.max(1, Math.min(shape.rows, Math.ceil(largest / shape.columns))),
  }
}

/** The shape cut to the columns the largest group fills, at its rows. Run after `trimRows`. */
export function fitColumns<T>(shape: GridShape, groups: readonly PageGroup<T>[]): GridShape {
  const largest = Math.max(0, ...groups.map((group) => group.items.length))
  return { columns: Math.max(1, Math.min(shape.columns, Math.ceil(largest / shape.rows))), rows: shape.rows }
}

/** The page holding the item with `id`, or -1 when no page does. */
export function pageOf<T extends { readonly id: string }>(pages: readonly GridPage<T>[], id: string): number {
  return pages.findIndex((page) => page.slots.some((slot) => slot?.id === id))
}

/** `index` wrapped into `0..count - 1`, so paging past either end comes round. */
export function wrapPage(index: number, count: number): number {
  if (count <= 0) return 0
  return ((index % count) + count) % count
}
