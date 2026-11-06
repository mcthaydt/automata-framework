<!--
  The palette for the selected layer (plan ED2D.4c4a decisions 4 and 5; 2D editor spec §8, §12): tiles as 44 px cells
  cut from the tileset image (numbered flat placeholders without it, as the canvas draws them), IntGrid values and
  entity definitions as rows with their colour and name. One choice at a time (`radiogroup`), held by the controller.
-->
<script lang="ts">
import { spriteStyle } from '../../app/editor-2d/tile-sprite'
import { isChosen, type PaletteItem } from './palette-model'

interface Props {
  /** The layer's name, for the heading. */
  layer: string
  items: readonly PaletteItem[]
  word: number
  entityDef: string | undefined
  /** A URL a CSS background can show for a workspace image, once it is read. */
  imageUrl: (path: string) => string | undefined
  onchoose: (item: PaletteItem) => void
}

const { layer, items, word, entityDef, imageUrl, onchoose }: Props = $props()

const CELL = 44
const tiles = $derived(items.length > 0 && items.every((item) => item.kind === 'tile'))

const keyOf = (item: PaletteItem): string =>
  item.kind === 'entity' ? `entity-${item.def}` : `word-${item.word}`
</script>

<section class="palette" aria-labelledby="palette-heading">
  <h2 id="palette-heading">Paint with · {layer}</h2>
  {#if items.length === 0}
    <p class="empty">Nothing to paint on this layer yet.</p>
  {:else}
    <div class="choices" class:tiles role="radiogroup" aria-labelledby="palette-heading">
      {#each items as item (keyOf(item))}
        {@const chosen = isChosen(item, { word, entityDef })}
        {#if item.kind === 'tile'}
          {@const drawn = item.image !== undefined && imageUrl(item.image.path) !== undefined}
          <button
            type="button"
            role="radio"
            class="tile"
            aria-checked={chosen}
            aria-label={item.label}
            data-choice={keyOf(item)}
            style={spriteStyle(item, item.image === undefined ? undefined : imageUrl(item.image.path), CELL)}
            onclick={() => onchoose(item)}>{drawn ? '' : item.tile}</button
          >
        {:else}
          <button
            type="button"
            role="radio"
            class="row"
            aria-checked={chosen}
            data-choice={keyOf(item)}
            onclick={() => onchoose(item)}
          >
            <span class="swatch" style={`background-color: ${item.color}`}></span>
            <span class="name">{item.label}</span>
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</section>

<style>
  .palette {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
  }
  h2 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-label-12);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .choices {
    display: grid;
    gap: var(--space-1);
  }
  .choices.tiles {
    grid-template-columns: repeat(auto-fill, 44px);
  }
  button {
    border: 0;
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  .tile {
    width: 44px;
    height: 44px;
    padding: 0;
    background-repeat: no-repeat;
    image-rendering: pixelated;
    color: var(--color-text-primary);
    font: var(--text-label-12);
    text-shadow: 0 1px 1px rgb(0 0 0 / 0.6);
  }
  .tile[aria-checked='true'] {
    box-shadow:
      0 0 0 2px var(--color-bg-surface),
      0 0 0 4px var(--color-accent-default);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: 0 var(--space-2);
    background: transparent;
    text-align: start;
  }
  .row[aria-checked='true'] {
    background: var(--color-accent-soft);
  }
  .swatch {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
