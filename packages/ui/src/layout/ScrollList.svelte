<!--
  A list that keeps its rows (M1.6 spec §3.4; from FloorFifty `ui/layout/ScrollList.svelte` at 122a220).

  It reserves `min(minRows, rowCount)` rows of `--af-row-h` as its minimum height, so on a short
  screen its siblings shrink before a row is lost. The reserve is capped at the height its parent
  gives it: where even that cannot hold the rows (TV scale on a compact phone) the list keeps what
  fits and scrolls the rest inside its own box, rather than painting over the controls below it. For that to work its parent must give it a
  `1fr` grid row or `flex: 1 1 auto`, never `minmax(0, 1fr)`, which ignores an item's minimum.
  Rows mark themselves `data-row`. It is a declared scroll region (`data-scroll-region`): the layout
  contracts allow controls to be off screen only inside one.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import { observeWidth } from './observe-size'
import { reservedRows, rowsBelow } from './scroll-list'

interface Props {
  minRows: number
  rowCount: number
  /** The CSS gap between rows, so the reserve holds whole rows and the gaps between them. */
  rowGap?: string | undefined
  /** The region's accessible name. */
  label: string
  /** "+N more", in the game's language. */
  moreLabel: (count: number) => string
  children: Snippet
  testId?: string | undefined
}

const { minRows, rowCount, rowGap, label, moreLabel, children, testId }: Props = $props()

/** Where the last reserved row ends, once rows have a height; 0 before. */
let measured = $state(0)
/** Whether the reserved rows share lines (a grid): then the row token over-counts them. */
let sideBySide = $state(false)
let list = $state<HTMLElement | undefined>(undefined)
let hidden = $state(0)

/** The reserve: the rows at the row token (and their gaps), or where the last of them ends if further. */
const reserve = $derived.by(() => {
  const rows = reservedRows(minRows, rowCount)
  const token =
    rowGap === undefined || rows < 2
      ? `calc(${rows} * var(--af-row-h))`
      : `calc(${rows} * var(--af-row-h) + ${rows - 1} * ${rowGap})`
  if (measured > 0 && sideBySide) return `${Math.ceil(measured)}px`
  return measured > 0 ? `max(${token}, ${Math.ceil(measured)}px)` : token
})

/**
 * Each row's foot in the list's scrolled coordinates, from its box. Where nothing is laid out
 * (jsdom) every box is empty, and the feet are the rows' heights stacked.
 */
function rowBottoms(view: HTMLElement, rows: readonly HTMLElement[]): number[] {
  const boxes = rows.map((row) => row.getBoundingClientRect())
  if (boxes.some((box) => box.height > 0)) {
    const top = view.getBoundingClientRect().top + view.clientTop - view.scrollTop
    return boxes.map((box) => (box.height > 0 ? box.bottom - top : 0))
  }
  let stacked = 0
  return rows.map((row) => {
    stacked += row.offsetHeight
    return stacked
  })
}

function count(): void {
  if (list === undefined) return
  const rows = [...list.querySelectorAll<HTMLElement>('[data-row]')]
  const bottoms = rowBottoms(list, rows)
  hidden = rowsBelow(list.scrollTop + list.clientHeight, bottoms)
  const reserved = bottoms.slice(0, reservedRows(minRows, rowCount))
  measured = Math.max(0, ...reserved)
  sideBySide = reserved.length > 1 && new Set(reserved.map(Math.round)).size < reserved.length
}

$effect(() => {
  const node = list
  if (node === undefined) return
  void rowCount
  count()
  return observeWidth(node, count)
})
</script>

<div
  bind:this={list}
  class="af-scroll-list"
  data-scroll-region
  data-min-rows={minRows}
  data-more={hidden > 0 ? 'true' : undefined}
  data-testid={testId}
  aria-label={label}
  role="region"
  style:min-height={`min(${reserve}, 100%)`}
  onscroll={count}
>
  {@render children()}
  {#if hidden > 0}
    <span data-testid="scroll-more" class="af-scroll-list__more" aria-hidden="true">{moreLabel(hidden)}</span>
  {/if}
</div>

<style>
  /* It clips what scrolls, so it pads in by a ring's reach and pulls back by it: a focused row's
     ring is drawn whole, and nothing moves. */
  .af-scroll-list {
    position: relative;
    min-width: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--af-ring-room);
    margin: calc(-1 * var(--af-ring-room));
    scroll-padding: var(--af-ring-room);
  }

  /* Rows run on under a soft edge when there are more than fit. A mask reads only alpha. */
  .af-scroll-list[data-more="true"] {
    mask-image: linear-gradient(to bottom, #000 calc(100% - var(--af-row-h) / 2), transparent);
  }

  /* A label, never a target: it can sit over the last row's control, and a tap there must reach it. */
  .af-scroll-list__more {
    pointer-events: none;
    position: sticky;
    bottom: 4px;
    display: block;
    width: max-content;
    margin: 4px auto 0;
    padding: 2px 10px;
    font: 600 var(--af-text-small) / 1.4 var(--af-font);
    color: var(--af-on-accent);
    background: var(--af-accent);
    border-radius: var(--af-radius);
  }
</style>
