<!--
  The Tuner's panel: a search box and the tunables as a list, a lock mark on each locked one. Choosing one is the
  controller's selection, which the inspector shows; the search keeps the rows whose name or note contains the text.
-->
<script lang="ts">
import type { TunerController } from '../tuner-controller'

const { controller }: { controller: TunerController } = $props()

// svelte-ignore state_referenced_locally
const revision = controller.revision
// svelte-ignore state_referenced_locally
const selected = controller.selected
// svelte-ignore state_referenced_locally
const filter = controller.filter

/** Whether a tunable is locked; reads the revision so a lock redraws the rows. */
const isLocked = (name: string): boolean => {
  void $revision
  return controller.isLocked(name)
}

const rows = $derived.by(() => {
  void $revision
  void $filter
  return controller.visible()
})
</script>

<div class="panel" data-testid="tuner-panel">
  <input
    class="search"
    type="search"
    aria-label="Search tunables"
    placeholder="Search tunables"
    value={$filter}
    oninput={(event) => controller.setFilter(event.currentTarget.value)}
  />
  <ul>
    {#each rows as tunable (tunable.name)}
      {@const locked = isLocked(tunable.name)}
      <li>
        <button
          type="button"
          class:chosen={$selected === tunable.name}
          aria-pressed={$selected === tunable.name}
          onclick={() => controller.select(tunable.name)}
        >
          <span>{tunable.name}</span>
          {#if locked}<span class="mark">Locked</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .panel {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .search {
    min-height: 44px;
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border-default, #3a3f48);
    border-radius: 8px;
    background: var(--color-surface-base, #14161a);
    color: inherit;
    font: inherit;
  }
  ul {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: 44px;
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  button.chosen {
    border-color: var(--color-accent, #d9a441);
  }
  .mark {
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
  }
</style>
