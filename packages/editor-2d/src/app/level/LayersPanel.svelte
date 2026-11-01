<!--
  The layer list (plan ED2D.4c4a decision 4; 2D editor spec §8, mockup `level-platformer`): the level's layers front to
  back, each with its kind in plain words, a Show or Hide button and a Lock or Unlock button. Choosing a row makes it the
  layer the tools draw on. The list is a `listbox` with one tab stop; arrows move the choice. Every button is 44 px.
-->
<script lang="ts">
import type { LayerDef } from '../../model/project-types'

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
  <!-- A button inside an option is nested interactive content, so the options hold the names only and the Show and Lock
       buttons are a column of their own beside the list. Rows are one fixed height, so the two columns line up. -->
  <div class="rows">
    <ul
      role="listbox"
      tabindex="0"
      aria-label="Layers"
      aria-activedescendant={`layer-${current}`}
      onkeydown={step}
    >
      {#each layers as layer (layer.id)}
        <li
          id={`layer-${layer.id}`}
          role="option"
          aria-selected={layer.id === current}
          data-layer={layer.id}
          class:hidden={hidden.has(layer.id)}
          onclick={() => onselect(layer.id)}
        >
          <span class="label">{layer.label}</span>
          <span class="kind">{KIND_WORDS[layer.kind]}</span>
        </li>
      {/each}
    </ul>
    <div class="toggles" role="group" aria-label="Layer visibility and locks">
      {#each layers as layer (layer.id)}
        {@const isHidden = hidden.has(layer.id)}
        {@const isLocked = locked.has(layer.id)}
        <div class="pair">
          <button
            type="button"
            class="toggle"
            aria-pressed={isHidden}
            aria-label={`${isHidden ? 'Show' : 'Hide'} ${layer.label}`}
            onclick={() => onhidden(layer.id, !isHidden)}>{isHidden ? 'Show' : 'Hide'}</button
          >
          <button
            type="button"
            class="toggle"
            aria-pressed={isLocked}
            aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${layer.label}`}
            onclick={() => onlocked(layer.id, !isLocked)}>{isLocked ? 'Unlock' : 'Lock'}</button
          >
        </div>
      {/each}
    </div>
  </div>
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
  .rows {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-1);
    align-items: start;
  }
  ul,
  .toggles {
    display: grid;
    grid-auto-rows: 44px;
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
    display: grid;
    align-content: center;
    min-width: 0;
    padding: 0 var(--space-2);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    cursor: pointer;
  }
  li[aria-selected='true'] {
    background: var(--color-accent-soft);
  }
  li.hidden .label {
    color: var(--color-text-faint);
  }
  .pair {
    display: flex;
    gap: var(--space-1);
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
    min-width: 56px;
    min-height: 44px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-label-12);
    cursor: pointer;
  }
</style>
