<!--
  The canvas of a sentence editor: a page of the app's paper, not a stage, so the text tokens read. It sets the type of
  the headings, paragraphs and cards an editor puts on it, and keeps the reading width.
-->
<script lang="ts">
import type { Snippet } from 'svelte'

const { label, children }: { label: string; children: Snippet } = $props()
</script>

<section class="page" aria-label={label}>{@render children()}</section>

<style>
  .page {
    display: grid;
    align-content: start;
    grid-template-columns: minmax(0, 40rem);
    gap: var(--space-4);
    box-sizing: border-box;
    height: 100%;
    padding: var(--space-5);
    overflow-y: auto;
    background: var(--color-bg-app);
  }
  .page :global(h2) {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  .page :global(h3) {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
  .page :global(p) {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .page :global(.card) {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-md);
    background: var(--color-bg-surface);
  }
  .page :global(.card > header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .page :global(.fields) {
    display: grid;
    gap: var(--space-3);
  }
  .page :global(.actions) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .page :global(.bad) {
    color: var(--color-state-bad);
  }
</style>
