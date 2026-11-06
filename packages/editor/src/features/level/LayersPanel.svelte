<!--
  The layer list: the level's layers front to back, each a row with its colour, its name over what it holds in plain
  words ("Characters and items", "Walls and floors"), and two icon toggles, the eye (Hide or Show) and the lock (Lock
  or Unlock), each named for what a press does. Choosing a row makes it the layer the tools draw on. The list is a
  `listbox` with one tab stop; arrows move the choice. Every button is 44 px.
-->
<script lang="ts">
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
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

/** What a layer holds, in a player's words (spec 11.5). */
const KIND_WORDS: Readonly<Record<LayerDef['kind'], string>> = {
  tiles: 'Tiles',
  intgrid: 'Walls and floors',
  auto: 'Tiles that place themselves',
  entities: 'Characters and items',
  objects: 'Shapes',
}

/** Each kind's colour, the same token the canvas draws that layer's outlines in. */
const KIND_COLOUR: Readonly<Record<LayerDef['kind'], string>> = {
  tiles: 'var(--color-layer-tiles)',
  intgrid: 'var(--color-layer-intgrid)',
  auto: 'var(--color-layer-sky)',
  entities: 'var(--color-layer-entities)',
  objects: 'var(--color-layer-city)',
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
          <span class="swatch" style:background={KIND_COLOUR[layer.kind]} aria-hidden="true"></span>
          <span class="label">{layer.label}</span>
          <span class="kind">{KIND_WORDS[layer.kind]}</span>
        </button>
        <span class="toggle">
          <IconButton
            icon={isHidden ? 'eye-off' : 'eye'}
            label={`${isHidden ? 'Show' : 'Hide'} ${layer.label}`}
            pressed={isHidden}
            tabindex={-1}
            onclick={() => onhidden(layer.id, !isHidden)}
          />
        </span>
        <span class="toggle">
          <IconButton
            icon={isLocked ? 'lock' : 'unlock'}
            label={`${isLocked ? 'Unlock' : 'Lock'} ${layer.label}`}
            pressed={isLocked}
            tabindex={-1}
            onclick={() => onlocked(layer.id, !isLocked)}
          />
        </span>
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
    border-radius: var(--edge-sm);
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
    border-radius: var(--edge-sm);
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
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    cursor: pointer;
  }
  .name {
    display: grid;
    grid-template-columns: 12px minmax(0, 1fr);
    column-gap: var(--space-2);
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    padding: 0 var(--space-2);
    text-align: start;
  }
  .swatch {
    grid-row: span 2;
    width: 12px;
    height: 12px;
    border-radius: var(--edge-sm);
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
    display: contents;
  }
</style>
