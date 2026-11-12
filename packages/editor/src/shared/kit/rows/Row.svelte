<!--
  One row of a list: 32 px (44 on touch), 6 px corners, a quiet hover and a chosen colour, an optional swatch or icon
  at the start (`lead`), the name, a second line of detail if it has one, and meta at the end (a count, a key). `actions`
  are the row's own buttons (hide, lock, remove): with a mouse they show while the pointer or the focus is on the row, on
  touch they are always there, each 44 px, so nothing a person needs hides behind a hover they cannot do.
  `wrap` lets the name run onto more lines instead of ending in an ellipsis, for a row that is a sentence (a switch) and must
  be read whole.
  The name is the row's button when the row can be chosen (`onclick`), so a screen reader hears it by name; the actions
  are beside it, never inside it.
-->
<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  selected?: boolean
  lead?: Snippet | undefined
  /** A second line under the name. */
  detail?: string | undefined
  /** Quiet words or a number at the end. */
  meta?: string | undefined
  actions?: Snippet | undefined
  onclick?: (() => void) | undefined
  /** The name may take more than one line. */
  wrap?: boolean
  children: Snippet
}

const { selected = false, lead, detail, meta, actions, onclick, wrap = false, children }: Props = $props()
</script>

{#snippet inner()}
  {#if lead !== undefined}<span class="lead">{@render lead()}</span>{/if}
  <span class="text">
    <span class="name">{@render children()}</span>
    {#if detail !== undefined}<span class="detail">{detail}</span>{/if}
  </span>
  {#if meta !== undefined}<span class="meta">{meta}</span>{/if}
{/snippet}

<div class="row" data-selected={selected} data-two-line={detail !== undefined} data-wrap={wrap}>
  {#if onclick !== undefined}
    <button type="button" class="main" aria-current={selected ? 'true' : undefined} {onclick}>{@render inner()}</button>
  {:else}
    <span class="main">{@render inner()}</span>
  {/if}
  {#if actions !== undefined}<span class="actions">{@render actions()}</span>{/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--size-hit);
    margin: 0 var(--space-2);
    border-radius: var(--edge-md);
    min-width: 0;
  }
  .row[data-two-line='true'] {
    min-height: 44px;
  }
  @media (hover: hover) {
    .row:hover {
      background: var(--surface);
    }
  }
  .row[data-selected='true'] {
    background: var(--tool-selected);
  }
  .main {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: inherit;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--edge-md);
    background: transparent;
    color: var(--ink);
    font: var(--text-body-13);
    text-align: left;
  }
  button.main {
    cursor: pointer;
  }
  .main:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .lead {
    display: inline-grid;
    flex: none;
    place-items: center;
    color: var(--muted);
  }
  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    padding: var(--space-1) 0;
  }
  .name,
  .detail {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row[data-wrap='true'] .name {
    overflow: visible;
    overflow-wrap: anywhere;
    text-overflow: clip;
    white-space: normal;
  }
  .detail {
    color: var(--tool-faint);
    font: var(--text-label-12);
  }
  .meta {
    margin-left: auto;
    color: var(--tool-faint);
    font: var(--text-mono-12);
    white-space: nowrap;
  }
  .actions {
    display: flex;
    flex: none;
    opacity: 0;
  }
  /* Row buttons are 28 px with a mouse and fade in under the pointer or the focus; touch keeps them whole at 44 px. */
  .actions :global(.icon-button) {
    width: var(--size-field);
    height: var(--size-field);
  }
  .row:hover .actions,
  .row:focus-within .actions,
  .actions:has(:global([aria-pressed='true'])) {
    opacity: 1;
  }
  @media (any-pointer: coarse) {
    .actions {
      opacity: 1;
    }
  }
</style>
