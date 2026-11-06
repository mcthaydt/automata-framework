<!--
  The inspector's Problems tab (`checks`): the profile's findings about
  this level, read only, in the profile's order. A finding about an instance is a 44 px button that selects it; fixes are not offered here yet.
-->
<script lang="ts">
import type { CheckRow } from './inspector-model'

interface Props {
  /** The level's name, for the list's accessible name. */
  name: string
  rows: readonly CheckRow[]
  onselect: (id: string) => void
}

const { name, rows, onselect }: Props = $props()
</script>

<div class="tab" data-testid="checks-tab">
  {#if rows.length === 0}
    <p class="empty">No problems in this level.</p>
  {:else}
    <ul class="list" aria-label={`Findings in ${name}`}>
      {#each rows as row (row.path + row.message)}
        <li data-severity={row.severity}>
          {#if row.item !== undefined}
            {@const item = row.item}
            <button type="button" class="row" onclick={() => onselect(item)}>
              <span class="severity">{row.severity}</span>{row.message}
            </button>
          {:else}
            <span class="row"><span class="severity">{row.severity}</span>{row.message}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .tab {
    padding: var(--space-3);
    min-width: 0;
  }
  .empty {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .list {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: start;
  }
  button.row {
    cursor: pointer;
  }
  .severity {
    color: var(--color-text-dim);
    font: var(--text-label-12);
    text-transform: capitalize;
  }
  [data-severity='error'] .severity {
    color: var(--color-state-bad);
  }
  [data-severity='warning'] .severity {
    color: var(--color-state-warn);
  }
</style>
