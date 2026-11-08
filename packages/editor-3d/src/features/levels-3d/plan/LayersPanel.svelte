<!--
  The layers panel (ED3D.5d; ED3D spec §5.2 and §9): a row per layer from `layerRows`, with its swatch, name and count.
  Pressing the name makes it the layer the tools work on; Hide or Show and Lock or Unlock are named for what a press does
  and say with `aria-pressed` when they are on. A hidden layer is not drawn and not hit, a locked one is drawn and not
  hit. A sub-layer under a hidden or locked Things says it is off with Things. Every button is at least 44 px.
-->
<script lang="ts">
import type { LayerRow } from './layers-model'

interface Props {
  rows: readonly LayerRow[]
  ontoggle: (list: 'hidden' | 'locked', layer: string) => void
  onactivate: (layer: string) => void
}

const { rows, ontoggle, onactivate }: Props = $props()
</script>

<section class="layers" aria-labelledby="layers-heading" data-testid="layers-panel">
  <h2 id="layers-heading">Layers</h2>
  <ul>
    {#each rows as row (row.id)}
      <li
        data-layer={row.id}
        data-depth={row.depth}
        data-inherited={row.inherited}
        class:off={row.hidden || row.inherited}
      >
        <button
          type="button"
          class="eye"
          aria-pressed={row.hidden}
          aria-label={`${row.hidden ? 'Show' : 'Hide'} ${row.label}`}
          onclick={() => ontoggle('hidden', row.id)}
        >
          <span aria-hidden="true">{row.hidden ? '◌' : '●'}</span>
        </button>
        <button
          type="button"
          class="name"
          aria-pressed={row.active}
          aria-label={row.inherited ? `${row.label}, off with Things` : row.label}
          onclick={() => onactivate(row.id)}
        >
          <span class="swatch" style:background={row.color} aria-hidden="true"></span>
          <span class="label">{row.label}</span>
          {#if row.inherited}<span class="note">Off with Things</span>{/if}
          <span class="count">{row.count}</span>
        </button>
        <button
          type="button"
          class="lock"
          aria-pressed={row.locked}
          aria-label={`${row.locked ? 'Unlock' : 'Lock'} ${row.label}`}
          onclick={() => ontoggle('locked', row.id)}
        >
          <span aria-hidden="true">{row.locked ? '🔒' : '🔓'}</span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .layers {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
  }
  h2 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-label-12);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }
  li[data-depth='1'] {
    padding-left: var(--space-4);
  }
  li.off .name {
    opacity: 0.5;
  }
  button {
    min-width: 44px;
    min-height: 44px;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-label-12);
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
  }
  .eye,
  .lock {
    flex: none;
    color: var(--color-text-dim);
  }
  .lock[aria-pressed='true'] {
    color: var(--color-accent-default);
  }
  .name {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    padding: 0 var(--space-2);
    text-align: left;
  }
  .name[aria-pressed='true'] {
    background: var(--color-accent-soft);
    color: var(--color-accent-default);
  }
  .swatch {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .note {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .count {
    flex: none;
    color: var(--color-text-faint);
    font-variant-numeric: tabular-nums;
  }
</style>
