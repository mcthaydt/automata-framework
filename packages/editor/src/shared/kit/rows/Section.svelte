<!--
  A section of a list or an inspector: a 32 px head of muted 12 px words (44 px on touch), a count in mono if it has one,
  and an add button at the end if it can grow, with a hairline between one section and the next. It holds rows
  (`Row`) or fields (`Field`); a section never draws a box of its own.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import IconButton from '../widgets/IconButton.svelte'

interface Props {
  label: string
  count?: number | undefined
  onadd?: (() => void) | undefined
  /** The add button's name; "Add to <label>" when left out. */
  addLabel?: string | undefined
  children: Snippet
}

const { label, count, onadd, addLabel, children }: Props = $props()
</script>

<section class="sec" aria-label={label}>
  <header class="head">
    <h3 class="label">{label}</h3>
    {#if count !== undefined}<span class="count">{count}</span>{/if}
    {#if onadd !== undefined}
      <span class="add"><IconButton icon="plus" label={addLabel ?? `Add to ${label}`} onclick={onadd} /></span>
    {/if}
  </header>
  {@render children()}
</section>

<style>
  .sec {
    padding: var(--space-2) 0 var(--space-3);
  }
  :global(.sec + .sec) {
    border-top: 1px solid var(--line);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--size-hit);
    padding: 0 var(--space-2) 0 var(--space-4);
    color: var(--muted);
  }
  .label {
    margin: 0;
    font: var(--text-label-12);
    font-weight: 500;
  }
  .count {
    color: var(--tool-faint);
    font: var(--text-mono-12);
  }
  .add {
    margin-left: auto;
  }
  /* The add button is a 28 px square with a mouse, as the head is, and 44 px on touch. */
  .add :global(.icon-button) {
    width: var(--size-field);
    height: var(--size-field);
  }
</style>
