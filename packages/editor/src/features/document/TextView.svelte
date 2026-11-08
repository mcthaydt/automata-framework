<!--
  The read-only view of a file that does not open. It draws a window
  of at most 400 lines with their numbers, marks the lines an error points at (in colour, and in words for a screen reader) and scrolls the first of them into view.
  It is its own scroll region in both directions: long lines scroll rather than wrap, so a column number stays true,
  and the page never moves. Nothing in it can be edited.
-->
<script lang="ts">
import { textWindow } from '../../shared/level-2d/session/open-flow-model'

interface Props {
  text: string
  /** Lines (from 1) an error points at. */
  marked: readonly number[]
}

const { text, marked }: Props = $props()

const view = $derived(textWindow(text, marked[0]))
const markedSet = $derived(new Set(marked))
const last = $derived(view.first + view.lines.length - 1)

/** Brings the first marked line into the middle of the view once it is drawn. */
function revealFirstMark(node: HTMLElement): void {
  const mark = node.querySelector<HTMLElement>('[data-marked]')
  if (mark === null) return
  // Measured against the view itself: `offsetTop` would count from the dialog, which is the positioned ancestor.
  const offset = mark.getBoundingClientRect().top - node.getBoundingClientRect().top
  node.scrollTop = Math.max(0, offset - (node.clientHeight - mark.offsetHeight) / 2)
}
</script>

<div class="text-view" data-testid="text-view" data-selectable>
  <div class="head">
    <span class="eyebrow">Read only</span>
    {#if view.total > view.lines.length}
      <span class="range">Lines {view.first} to {last} of {view.total}</span>
    {/if}
  </div>
  {#if view.total === 0}
    <p class="empty">The file is empty.</p>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex: a keyboard has to be able to scroll the text -->
    <div class="lines" data-scroll-region tabindex="0" role="region" aria-label="The file’s text" use:revealFirstMark>
      {#each view.lines as line, index (index)}
        {@const number = view.first + index}
        {#if markedSet.has(number)}
          <div class="line" data-marked>
            <span class="number">{number}</span><span class="code">{line}</span><span class="visually-hidden"
              >error on this line</span
            >
          </div>
        {:else}
          <div class="line"><span class="number">{number}</span><span class="code">{line}</span></div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .text-view {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    overflow: hidden;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }
  .eyebrow {
    color: var(--color-text-faint);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  .range {
    color: var(--color-text-faint);
    font: var(--text-label-12);
  }
  .empty {
    margin: 0;
    padding: 0 var(--space-3) var(--space-3);
    color: var(--color-text-dim);
  }
  .lines {
    max-height: 14rem;
    overflow: auto;
    overscroll-behavior: contain;
    touch-action: pan-x pan-y;
    padding-bottom: var(--space-2);
    font: var(--text-mono-12);
  }
  .lines:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
  }
  .line {
    position: relative;
    display: flex;
    gap: var(--space-3);
    width: max-content;
    min-width: 100%;
    padding: 0 var(--space-3);
    line-height: 22px;
    white-space: pre;
    color: var(--color-text-dim);
  }
  .line[data-marked] {
    background: color-mix(in srgb, var(--color-state-warn) 14%, transparent);
    color: var(--color-text-primary);
  }
  .number {
    flex: none;
    width: 3ch;
    text-align: right;
    color: var(--color-text-faint);
  }
  /* Read by a screen reader, not drawn: the colour says it to the eye. */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .line[data-marked] .number {
    color: var(--color-state-warn);
  }
</style>
