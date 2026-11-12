<!--
  @component
  A list that keeps its rows.

  It reserves `min(minRows, rowCount)` rows of `--af-row-h` as its minimum height, so on a short
  screen its siblings shrink before a row is lost. The reserve is capped at the height its parent
  gives it: where even that cannot hold the rows (TV scale on a compact phone) the list keeps what
  fits and scrolls the rest inside its own box, rather than painting over the controls below it. For that to work its parent must give it a
  `1fr` grid row or `flex: 1 1 auto`, never `minmax(0, 1fr)`, which ignores an item's minimum.
  Rows mark themselves `data-row`. It is a declared scroll region (`data-scroll-region`): the layout
  contracts allow controls to be off screen only inside one.

  It is two siblings in one frame: the scroll box, and below it the "+N more" label when rows are out of view.
  The label is never inside the box, where it would sit over the last row in view and cover its words; the frame
  reserves the label's height on top of the rows, so showing it takes room from the box, not from a row's label.
  The frame is what the parent lays out (the `1fr` row, the flex item). Where even the reserve and the label together
  do not fit the room the parent gives (a compact screen at TV scale), the label gives way, not a row: the box keeps
  its reserved rows whole, and the soft edge and `data-more` still say that there are more.
-->
<script lang="ts">
import { type Snippet, untrack } from 'svelte'
import { observeSize, observeWidth } from './observe-size'
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
let list = $state<HTMLElement | null | undefined>(undefined)
let hidden = $state(0)
let foot = $state<HTMLElement | null | undefined>(undefined)
/** The "+N more" label's height with its spacing, as last laid out; 0 until it has shown once. */
let footHeight = $state(0)
/** Whether the label and the reserved rows both fit the room the parent gives; the label shows only if they do. */
let labelFits = $state(true)
/** Whether the label is drawn: rows are out of view and there is room for it beside the reserved rows. */
const labelShown = $derived(hidden > 0 && labelFits)

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

/** The frame's minimum: the reserve, and the label's room while the label shows, capped at what the parent gives. */
const frameMinHeight = $derived(
  labelShown && footHeight > 0 ? `min(calc(${reserve} + ${footHeight}px), 100%)` : `min(${reserve}, 100%)`,
)

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
  // Svelte sets a bound element to null, not undefined, when it goes; the measure must not reach for it then.
  if (list == null) return
  const rows = [...list.querySelectorAll<HTMLElement>('[data-row]')]
  const bottoms = rowBottoms(list, rows)
  hidden = rowsBelow(list.scrollTop + list.clientHeight, bottoms)
  const reserved = bottoms.slice(0, reservedRows(minRows, rowCount))
  measured = Math.max(0, ...reserved)
  sideBySide = reserved.length > 1 && new Set(reserved.map(Math.round)).size < reserved.length
  // The room the box and the label share is the box's own height plus the label's, if it is drawn now. The label
  // fits where taking its height still leaves the reserved rows whole. Before the label has been measured there is
  // nothing to weigh, so it shows once and is measured.
  const label = untrack(() => footHeight)
  const room = list.clientHeight + (untrack(() => labelShown) ? label : 0)
  labelFits = label === 0 || measured === 0 || room - label >= measured - 0.5
}

$effect(() => {
  const node = list
  if (node == null) return
  void rowCount
  count()
  return observeWidth(node, count)
})

// The frame reserves the label's room, so the label's height is measured as laid out.
$effect(() => {
  const node = foot
  if (node == null) return
  footHeight = node.offsetHeight
  count()
  return observeSize(node, () => {
    footHeight = node.offsetHeight
    count()
  })
})
</script>

<div class="af-scroll-frame" style:min-height={frameMinHeight}>
  <div
    bind:this={list}
    class="af-scroll-list"
    data-scroll-region
    data-min-rows={minRows}
    data-more={hidden > 0 ? 'true' : undefined}
    data-testid={testId}
    aria-label={label}
    role="region"
    onscroll={count}
  >
    {@render children()}
  </div>
  {#if labelShown}
    <div class="af-scroll-frame__foot" bind:this={foot}>
      <span data-testid="scroll-more" class="af-scroll-list__more" aria-hidden="true">{moreLabel(hidden)}</span>
    </div>
  {/if}
</div>

<style>
  /* What the parent lays out. It pulls back by a ring's reach, as the box inside pads in by it: a focused row's
     ring is drawn whole, and nothing moves. */
  .af-scroll-frame {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin: calc(-1 * var(--af-ring-room));
  }

  /* It clips what scrolls, so it pads in by a ring's reach: a focused row's ring is drawn whole. It takes what the
     label leaves, down to nothing, so the frame's reserve is what keeps the rows. It stays positioned: a control
     drawn absolutely inside a row (a radio's input) belongs to the box that scrolls, not to the page. */
  .af-scroll-list {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--af-ring-room);
    scroll-padding: var(--af-ring-room);
  }

  /* Rows run on under a soft edge when there are more than fit. A mask reads only alpha. */
  .af-scroll-list[data-more="true"] {
    mask-image: linear-gradient(to bottom, #000 calc(100% - var(--af-row-h) / 2), transparent);
  }

  /* The label's own line under the box, in the room the frame reserves for it. */
  .af-scroll-frame__foot {
    flex: none;
    display: flex;
    justify-content: center;
    padding: 4px 0 var(--af-ring-room);
  }

  /* A label, never a target. */
  .af-scroll-list__more {
    pointer-events: none;
    display: block;
    width: max-content;
    padding: 2px 10px;
    font: 600 var(--af-text-small) / 1.4 var(--af-font);
    color: var(--af-on-accent);
    background: var(--af-accent);
    border-radius: var(--af-radius);
  }
</style>
