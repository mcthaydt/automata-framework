import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PagedGrid from '#src/shared/ui/layout/PagedGrid.svelte'
import {
  fitColumns,
  fitShape,
  type PageGroup,
  pageOf,
  paginate,
  tileSide,
  trimRows,
  wrapPage,
} from '#src/shared/ui/layout/paged-grid.ts'

// The page arithmetic of FloorFifty tests/client/ui/tile-pages.test.ts at ac72660, generic over the item type.
// FloorFifty's tile types and `stackedSide` stay in FloorFifty.
interface Item {
  readonly id: string
}
const item = (id: string): Item => ({ id })
const group = (id: string, title: string, ids: readonly string[]): PageGroup<Item> => ({
  id,
  title,
  items: ids.map(item),
})

describe('paginate', () => {
  it('puts one group on a page, padding an unfilled page with empty slots', () => {
    const pages = paginate([group('base', 'Base', ['a', 'b', 'c']), group('friends', 'Friends', ['d'])], 4)
    expect(pages.map((page) => page.title)).toEqual(['Base', 'Friends'])
    expect(pages[0]?.slots.map((slot) => slot?.id)).toEqual(['a', 'b', 'c', undefined])
    expect(pages[1]?.slots).toHaveLength(4)
  })

  it('continues a long group under the same title with (2), or as `continued` words it', () => {
    const groups = [group('base', 'Base', ['a', 'b', 'c', 'd', 'e'])]
    const pages = paginate(groups, 3)
    expect(pages.map((page) => page.title)).toEqual(['Base', 'Base (2)'])
    expect(pages.every((page) => page.groupId === 'base')).toBe(true)
    expect(paginate(groups, 3, (title, part) => `${title}, part ${part}`)[1]?.title).toBe('Base, part 2')
  })

  it('skips an empty group', () => {
    expect(paginate([group('none', 'None', [])], 3)).toEqual([])
  })
})

describe('fitShape', () => {
  it('keeps the most the box can hold', () => {
    expect(fitShape({ columns: 4, rows: 1 }, { width: 600, height: 200 }, 44, 8)).toEqual({
      columns: 4,
      rows: 1,
    })
  })

  it('drops rows first, then columns, never below one', () => {
    expect(fitShape({ columns: 5, rows: 2 }, { width: 400, height: 60 }, 44, 8)).toEqual({
      columns: 5,
      rows: 1,
    })
    expect(fitShape({ columns: 5, rows: 2 }, { width: 100, height: 60 }, 44, 8)).toEqual({
      columns: 2,
      rows: 1,
    })
    expect(fitShape({ columns: 3, rows: 3 }, { width: 10, height: 10 }, 44, 8)).toEqual({
      columns: 1,
      rows: 1,
    })
  })
})

describe('tileSide', () => {
  const limits = { peek: 0, min: 44, max: 128 }
  const unbounded = Number.POSITIVE_INFINITY

  it("leaves room for the next page's peek", () => {
    // 3 tiles of 100 and two 8 px gaps, plus 0.35 of a tile peeking: 351.
    expect(
      tileSide({ columns: 3, rows: 1 }, { width: 351, height: unbounded }, 8, { ...limits, peek: 0.35 }),
    ).toBe(100)
  })

  it('sizes by width alone when the box sets no height', () => {
    expect(tileSide({ columns: 3, rows: 2 }, { width: 316, height: unbounded }, 8, limits)).toBe(100)
  })

  it('takes the tighter axis when the box has a height', () => {
    expect(tileSide({ columns: 3, rows: 2 }, { width: 316, height: 128 }, 8, limits)).toBe(60)
  })

  it('never grows past the largest tile or shrinks below a finger', () => {
    expect(tileSide({ columns: 3, rows: 1 }, { width: 2000, height: unbounded }, 8, limits)).toBe(128)
    expect(tileSide({ columns: 3, rows: 1 }, { width: 40, height: 20 }, 8, limits)).toBe(44)
  })
})

describe('trimRows', () => {
  const sized = (count: number) =>
    group(
      `p${count}`,
      'P',
      Array.from({ length: count }, (_, index) => `i${index}`),
    )

  it('keeps no row that no group can fill', () => {
    expect(trimRows({ columns: 3, rows: 2 }, [sized(3), sized(2)])).toEqual({ columns: 3, rows: 1 })
  })

  it('keeps the rows the largest group needs, up to the shape', () => {
    expect(trimRows({ columns: 3, rows: 2 }, [sized(4)])).toEqual({ columns: 3, rows: 2 })
    expect(trimRows({ columns: 3, rows: 2 }, [sized(9)])).toEqual({ columns: 3, rows: 2 })
  })

  it('never goes below one row', () => {
    expect(trimRows({ columns: 3, rows: 2 }, [])).toEqual({ columns: 3, rows: 1 })
  })
})

describe('paging', () => {
  const pages = paginate([group('base', 'Base', ['a', 'b', 'c', 'd', 'e'])], 2)

  it("finds an item's page", () => {
    expect(pageOf(pages, 'e')).toBe(2)
    expect(pageOf(pages, 'zzz')).toBe(-1)
  })

  it('wraps from the last page to the first and back', () => {
    expect(wrapPage(3, 3)).toBe(0)
    expect(wrapPage(-1, 3)).toBe(2)
  })
})

describe('fitColumns', () => {
  const sized = (count: number) =>
    group(
      'base',
      'Base',
      Array.from({ length: count }, (_, index) => `c${index}`),
    )

  it('cuts the columns to what the largest group fills', () => {
    expect(fitColumns({ columns: 4, rows: 2 }, [sized(5)])).toEqual({ columns: 3, rows: 2 })
  })

  it('never adds columns', () => {
    expect(fitColumns({ columns: 4, rows: 1 }, [sized(9)])).toEqual({ columns: 4, rows: 1 })
  })

  it('keeps at least one column', () => {
    expect(fitColumns({ columns: 4, rows: 2 }, [])).toEqual({ columns: 1, rows: 2 })
  })
})

describe('PagedGrid', () => {
  let component: ReturnType<typeof mount> | undefined
  afterEach(() => {
    if (component !== undefined) unmount(component)
    component = undefined
    document.body.innerHTML = ''
  })

  const tile = createRawSnippet((entry: () => Item) => ({
    render: () => `<button type="button" data-tile>${entry().id}</button>`,
  }))

  function open(page: number, onpage = vi.fn()): HTMLElement {
    const target = document.createElement('div')
    document.body.append(target)
    component = mount(PagedGrid<Item>, {
      target,
      props: {
        label: 'Characters',
        groups: [group('base', 'Base', ['a', 'b', 'c', 'd', 'e']), group('friends', 'Friends', ['f'])],
        most: { columns: 2, rows: 1 },
        page,
        onpage,
        item: tile,
      },
    })
    flushSync()
    return target
  }

  it("shows one page's items in a focus grid that never scrolls, titled by its group", () => {
    const target = open(1)
    const grid = target.querySelector<HTMLElement>('[data-focus-grid]')
    expect([...(grid?.querySelectorAll('[data-tile]') ?? [])].map((tile) => tile.textContent)).toEqual([
      'c',
      'd',
    ])
    expect(grid?.dataset.scroll).toBe('never')
    expect(target.querySelector('[data-page-title]')?.textContent).toBe('Base (2)')
  })

  it('shows a dot per page and reports the page a dot asks for; the page stays the owner’s', () => {
    const onpage = vi.fn()
    const target = open(0, onpage)
    const dots = target.querySelectorAll<HTMLButtonElement>('[data-pager-dot]')
    expect(dots).toHaveLength(4)
    dots[3]?.click()
    expect(onpage).toHaveBeenCalledWith(3)
    expect(target.querySelector('[data-page-title]')?.textContent).toBe('Base')
  })
})
