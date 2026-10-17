<!--
  @component
  A grid of items in pages that never scrolls (M4 spec §4.8; the page arithmetic of FloorFifty `ui/tile-pages.ts`
  at `ac72660`). Each group starts its own page; the shape is `most`, cut to what the measured box holds at
  `minTile` and to what the largest group fills. PagerDots show where it is.

  The page is controlled: it reports `onpage` and shows the `page` it is given. A `[data-focus-grid]`, so the
  focus navigator steers through the tiles spatially, and paging comes from the owner (a page swipe, a pad's
  shoulder buttons, the dots).
-->
<script lang="ts" module>
import type { Snippet } from 'svelte'
import type { GridShape, PageGroup } from './paged-grid'

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
</script>

<script lang="ts" generics="T extends { readonly id: string }">
import { observeSize } from './observe-size'
import { fitColumns, fitShape, type GridBox, paginate, wrapPage } from './paged-grid'
import PagerDots from './PagerDots.svelte'


const { label, groups, most, page, onpage, item, minTile = 44, gap = 8, continued, dotLabel, testId }: PagedGridProps<T> =
  $props()

let box = $state<GridBox>({ width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY })
let area = $state<HTMLElement | undefined>(undefined)
// A tile is at least one target, so it grows with the host's scale (Ruken's TV mode), as PagerDots' dots do.
let scale = $state(1)

$effect(() => {
  if (area === undefined) return
  const measured = area
  return observeSize(measured, () => {
    const read = Number.parseFloat(getComputedStyle(measured).getPropertyValue('--af-scale'))
    scale = Number.isFinite(read) && read > 0 ? read : 1
    box = { width: measured.clientWidth, height: measured.clientHeight }
  })
})

const tile = $derived(minTile * scale)
const shape = $derived(fitColumns(fitShape(most, box, tile, gap), groups))
const pages = $derived(paginate(groups, shape.columns * shape.rows, continued))
const current = $derived(pages[wrapPage(page, pages.length)])
</script>

<section class="af-paged" aria-label={label} data-testid={testId}>
  {#if current !== undefined}
    <h3 class="af-paged__title" data-page-title>{current.title}</h3>
  {/if}
  <div bind:this={area} class="af-paged__area" style:min-height={`${tile}px`}>
    <div
      class="af-paged__grid"
      data-focus-grid
      data-scroll="never"
      style:gap={`${gap}px`}
      style:grid-template-columns={`repeat(${shape.columns}, minmax(0, 1fr))`}
      style:grid-template-rows={`repeat(${shape.rows}, minmax(0, 1fr))`}
    >
      {#each current?.slots ?? [] as slot, index (slot?.id ?? `empty-${index}`)}
        <div class="af-paged__slot">{#if slot !== undefined}{@render item(slot)}{/if}</div>
      {/each}
    </div>
  </div>
  {#if pages.length > 1}
    <PagerDots
      count={pages.length}
      index={wrapPage(page, pages.length)}
      {label}
      onselect={onpage}
      {...dotLabel === undefined ? {} : { dotLabel }}
    />
  {/if}
</section>

<style>
  .af-paged {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 8px;
    min-width: 0;
    min-height: 0;
  }

  .af-paged__title {
    margin: 0;
    color: var(--af-ink);
    font: 600 var(--af-text-body) / 1.2 var(--af-font);
  }

  /* The measured box: the page's shape comes from it, and nothing in it scrolls. It is never shorter than one row of
     tiles (its inline min-height), so with too little room the screen frame scrolls rather than the pager covering
     the tiles. */
  .af-paged__area {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .af-paged__grid {
    display: grid;
    height: 100%;
  }

  .af-paged__slot {
    display: grid;
    min-width: 0;
    min-height: 0;
  }
</style>
