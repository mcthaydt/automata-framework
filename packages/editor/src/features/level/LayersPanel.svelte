<!--
  The layer list (plan ED2D.4c4a decision 4; 2D editor spec §8, mockup `level-platformer`): the level's layers front to
  back, each with its kind in plain words, a Show or Hide button and a Lock or Unlock button. Choosing a row makes it the
  layer the tools draw on. The list is a `listbox` with one tab stop; arrows move the choice. Every button is 44 px.
-->
<script lang="ts">
import type { LayerDef } from '../../shared/level-2d/model/project-types'

interface Props {
  layers: readonly LayerDef[]
  current: string
  hidden: ReadonlySet<string>
  locked: ReadonlySet<string>
  onselect: (id: string) => void
  onhidden: (id: string, hidden: boolean) => void
  onlocked: (id: string, locked: boolean) => void
}

const { layers, current, hidden, locked, onselect, onhidden, onlocked }: Props = $props()

const KIND_WORDS: Readonly<Record<LayerDef['kind'], string>> = {
  tiles: 'Tiles',
  intgrid: 'Grid values',
  auto: 'Auto tiles',
  entities: 'Things',
  objects: 'Objects',
}

function step(event: KeyboardEvent): void {
  const index = layers.findIndex((layer) => layer.id === current)
  const next = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : undefined
  const target = next === undefined ? undefined : layers[next]
  if (target === undefined) return
  event.preventDefault()
  onselect(target.id)
}
</script>

<section class="layers" aria-labelledby="layers-heading">
  <h2 id="layers-heading">Layers</h2>
  <ul
    role="listbox"
    tabindex="0"
    aria-label="Layers"
    aria-activedescendant={`layer-${current}`}
    onkeydown={step}
  >
    {#each layers as layer (layer.id)}
      {@const isHidden = hidden.has(layer.id)}
      {@const isLocked = locked.has(layer.id)}
      <li
        id={`layer-${layer.id}`}
        role="option"
        aria-selected={layer.id === current}
        data-layer={layer.id}
        class:hidden={isHidden}
      >
        <button type="button" class="name" tabindex="-1" onclick={() => onselect(layer.id)}>
          <span class="label">{layer.label}</span>
          <span class="kind">{KIND_WORDS[layer.kind]}</span>
        </button>
        <button
          type="button"
          class="toggle"
          tabindex="-1"
          aria-pressed={isHidden}
          aria-label={`${isHidden ? 'Show' : 'Hide'} ${layer.label}`}
          onclick={() => onhidden(layer.id, !isHidden)}>{isHidden ? 'Show' : 'Hide'}</button
        >
        <button
          type="button"
          class="toggle"
          tabindex="-1"
          aria-pressed={isLocked}
          aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${layer.label}`}
          onclick={() => onlocked(layer.id, !isLocked)}>{isLocked ? 'Unlock' : 'Lock'}</button
        >
      </li>
    {/each}
  </ul>
</section>

<style>
  .layers {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
  }
  h2 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  ul {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    border-radius: var(--radius-md);
  }
  ul:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    border-radius: var(--radius-md);
  }
  li[aria-selected='true'] {
    background: var(--color-accent-soft);
  }
  li.hidden .label {
    color: var(--color-text-faint);
  }
  button {
    min-height: 44px;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    cursor: pointer;
  }
  .name {
    display: grid;
    flex: 1 1 auto;
    min-width: 0;
    padding: 0 var(--space-2);
    text-align: start;
  }
  .label,
  .kind {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .toggle {
    flex: 0 0 auto;
    min-width: 56px;
    padding: 0 var(--space-2);
    background: var(--color-bg-raised);
    font: var(--text-label-12);
  }
</style>
