<!--
  The live preview:
  the sample IntGrid painted with the chosen value beside what the auto layer's rules make of it, through the same
  engine and seed a level uses. The cells where the selected rule matches on its own are outlined. It redraws on every
  edit because it is derived from the project.
-->
<script lang="ts">
import { tileItems } from '../../shared/level-2d/editor/palette-model'
import { spriteStyle } from '../../shared/level-2d/editor/tile-sprite'
import type { Project } from '../../shared/level-2d/model/project-types'
import type { RulePreview } from './rule-preview'
import { autoLayersOf, type ResolvedSelection, sourceOf } from './tilesets-model'

interface Props {
  preview: RulePreview
  project: Project
  selection: ResolvedSelection
  images: ReadonlySet<string>
  imageUrl: (path: string) => string | undefined
}

const { preview, project, selection, images, imageUrl }: Props = $props()

const CELL = 20
const layer = $derived(autoLayersOf(project).find((def) => def.id === selection.layer))
const source = $derived(layer === undefined ? undefined : sourceOf(project, layer))
const value = $derived(source?.values.find((each) => each.value === selection.value))
const tiles = $derived(tileItems(preview.tileset, images))
const matched = $derived(new Set(preview.matched))
const cells = $derived(Array.from({ length: preview.source.cols * preview.source.rows }, (_, index) => index))

function tileStyle(tile: number, flipX: boolean, flipY: boolean): string {
  const item = tiles.find((each) => each.tile === tile)
  const flip = `transform: scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`
  if (item === undefined) return flip
  return `${spriteStyle(item, item.image === undefined ? undefined : imageUrl(item.image.path), CELL)}; ${flip}`
}
</script>

<section class="preview" aria-labelledby="preview-heading" data-testid="rule-preview">
  <div class="head">
    <h2 id="preview-heading">Live preview</h2>
    <span class="meta">{layer?.label}</span>
  </div>
  <div class="pair">
    <figure>
      <figcaption>Where you paint {value?.label ?? value?.id ?? ''} on {source?.label ?? ''}</figcaption>
      <div class="grid" style:--cols={preview.source.cols} data-testid="preview-source">
        {#each cells as index (index)}
          {@const filled = preview.source.get(index % preview.source.cols, Math.floor(index / preview.source.cols)) !== 0}
          <span class="cell" class:filled style:background-color={filled ? value?.color : undefined}></span>
        {/each}
      </div>
    </figure>
    <figure>
      <figcaption>The tiles {layer?.label ?? ''} places</figcaption>
      <div class="grid" style:--cols={preview.source.cols} data-testid="preview-result">
        {#each cells as index (index)}
          <span class="cell" class:matched={matched.has(index)} data-cell={index}>
            {#each preview.result.stacks.get(index) ?? [] as drawn, layerIndex (layerIndex)}
              <span class="tile" data-tile={drawn.tile} style={tileStyle(drawn.tile, drawn.flipX, drawn.flipY)}></span>
            {/each}
          </span>
        {/each}
      </div>
    </figure>
  </div>
  <p class="caption" role="status">
    {#if selection.rule === undefined}
      Choose a rule to see where it matches.
    {:else}
      Outlined: the {preview.matched.length === 1 ? '1 cell' : `${preview.matched.length} cells`} where {selection.rule}
      matches on its own.
    {/if}
  </p>
</section>

<style>
  .preview {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border-default);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }
  h2 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-label-12);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .meta,
  figcaption {
    color: var(--color-text-dim);
    font: var(--text-mono-11);
  }
  .pair {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }
  figure {
    display: grid;
    gap: var(--space-1);
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 20px);
    grid-auto-rows: 20px;
    width: max-content;
    background: var(--color-bg-canvas);
    border: 1px solid var(--color-border-default);
  }
  .cell {
    position: relative;
  }
  .cell.matched::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px dashed var(--color-accent-default);
  }
  .tile {
    position: absolute;
    inset: 0;
    background-repeat: no-repeat;
    image-rendering: pixelated;
  }
  .caption {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
</style>
