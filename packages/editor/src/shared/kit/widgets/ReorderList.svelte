<!--
  A list whose rows the person puts in order. Each row has a handle, 44 px wide, and the list
  reports exactly one `onreorder({ id, from, to })` per move, on the drop. The editor applies it and passes the new
  `items`; the list never reorders itself.

  Keyboard: Space on a handle lifts its row (`aria-pressed`), ArrowUp and ArrowDown move it one unlocked place,
  Space or Enter drops it and Escape puts it back. Every step is announced in a polite live region ("Moved Fog to
  place 3 of 4"), because the row's new place is otherwise only on screen.

  Pointer: pressing a handle and moving past the slop drags the row. The dragged row follows the pointer and the
  others shift to show the drop, as transforms, so no row leaves the DOM (and no focus is lost) until the drop. Near
  the top or bottom of the nearest scrolling ancestor the list scrolls itself (`reorder-scroll`). A
  cancelled pointer, Escape, or a drop on the row's own place reports nothing.

  A locked row keeps its place: its handle is `aria-disabled`, pressing it calls `onblocked` with its reason, and the
  other rows are never dropped onto it.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import type { BlockedProps } from './edit-event'
import { lockedReason, type ReorderItem, type ReorderMove, reorderSession } from './reorder-session.svelte'

interface RowState {
  dragging: boolean
  lifted: boolean
}

interface Props extends Pick<BlockedProps, 'onblocked'> {
  label: string
  items: readonly ReorderItem[]
  /** Draws a row's content beside its handle; without it the row shows its label. */
  item?: Snippet<[ReorderItem, RowState]> | undefined
  onreorder?: ((move: ReorderMove) => void) | undefined
}

const { label, items, item: content, onreorder, onblocked }: Props = $props()

let list = $state<HTMLElement>()
const handles: Record<string, HTMLElement | undefined> = {}
const uid = $props.id()
const handleId = (row: ReorderItem): string => `${uid}-${row.id}`

const move = reorderSession({
  items: () => items,
  list: () => list,
  handle: (id) => handles[id],
  onreorder: () => onreorder,
  onblocked: () => onblocked,
})
</script>

<!-- svelte-ignore a11y_no_redundant_roles -- Safari drops list semantics from a list with `list-style: none` -->
<ul class="list" role="list" aria-label={label} data-widget="reorder-list" bind:this={list}>
  {#each items as row, index (row.id)}
    {@const dragging = move.moving?.id === row.id && move.moving.kind === 'pointer' && move.moving.moved}
    {@const lifted = move.moving?.id === row.id && move.moving.kind === 'keyboard'}
    <li
      class="row"
      data-reorder-row
      data-dragging={dragging ? '' : undefined}
      data-lifted={lifted ? '' : undefined}
      data-locked={row.locked ? '' : undefined}
      style:transform={move.transformOf(index, row.id)}
    >
      <button
        type="button"
        class="handle"
        aria-label={`Reorder ${row.label}`}
        aria-pressed={lifted}
        aria-disabled={row.locked || undefined}
        aria-describedby={row.locked ? `${handleId(row)}-reason` : undefined}
        bind:this={handles[row.id]}
        onkeydown={(event) => move.keydown(event, row, index)}
        onkeyup={(event) => event.key === ' ' && event.preventDefault()}
        onblur={() => move.blur(row)}
        onpointerdown={(event) => move.pointerdown(event, index)}
        onpointermove={move.pointermove}
        onpointerup={move.pointerup}
        onpointercancel={move.pointercancel}
        onlostpointercapture={move.pointercancel}
        oncontextmenu={(event) => event.preventDefault()}
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
      {#if row.locked}<span class="reason" id={`${handleId(row)}-reason`}>{lockedReason(row)}</span>{/if}
      <div class="content">
        {#if content}{@render content(row, { dragging, lifted })}{:else}{row.label}{/if}
      </div>
    </li>
  {/each}
</ul>
<div class="reason" role="status" aria-live="polite">{move.announcement}</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: flex;
    align-items: center;
    min-height: var(--size-hit);
    border-bottom: 1px solid var(--line);
    background: var(--paper);
    transition: transform 120ms ease;
  }
  .row[data-dragging] {
    position: relative;
    z-index: 2;
    background: var(--paper);
    box-shadow: var(--shadow);
    transition: none;
  }
  .row[data-lifted] {
    background: var(--cobalt-soft);
  }
  .row[data-locked] {
    color: var(--muted);
  }
  @media (prefers-reduced-motion: reduce) {
    .row {
      transition: none;
    }
  }
  .handle {
    flex: 0 0 auto;
    width: var(--size-hit);
    min-height: var(--size-hit);
    align-self: stretch;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: var(--text-body-13);
    letter-spacing: -2px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .handle[aria-disabled='true'] {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .handle:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .content {
    flex: 1 1 auto;
    min-width: 0;
    padding: var(--space-2) var(--space-3) var(--space-2) 0;
    font: var(--text-body-13);
  }
  .reason {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
