<!--
  The selected definition drawn as it will stand in a level: a header with
  its id, where it is used, its size and its pivot, then the shape at a whole-number scale on a grid of its own size,
  the pivot marked and the sides labelled. A definition with a tile draws the tile's sprite in the shape's box.
-->
<script lang="ts">
import type { Project } from '../../shared/level-2d/model/project-types'
import { tileItems } from '../../shared/level-2d/tiles/palette-model'
import { spriteStyle } from '../../shared/level-2d/tiles/tile-sprite'
import { definitionPreview } from './entities-model'

interface Props {
  project: Project
  id: string
  images: ReadonlySet<string>
  imageUrl: (path: string) => string | undefined
  /** The preview pixels the shape may take: the canvas's width less its margins and labels. */
  room: { readonly w: number; readonly h: number }
}

const { project, id, images, imageUrl, room }: Props = $props()
const preview = $derived(definitionPreview(project, id, room))
const color = $derived(preview.color ?? 'var(--color-text-dim)')
const sprite = $derived.by(() => {
  const tile = preview.tile
  if (tile === undefined) return undefined
  const tileset = project.defs.tilesets.find((set) => set.id === tile.tileset)
  const item = tileItems(tileset, images)[tile.index]
  if (item === undefined || tileset === undefined) return undefined
  const url = tileset.image === undefined ? undefined : imageUrl(tileset.image)
  return `${spriteStyle(item, url, Math.max(preview.box.w, preview.box.h))}; background-repeat: no-repeat`
})
</script>

<section class="preview" aria-label="Preview" data-testid="entity-preview">
  <header>
    <span class="swatch" style:--swatch={color} aria-hidden="true"></span>
    <h2>{id}</h2>
    <span class="pill">{preview.instances}</span>
    <span class="pill">{preview.sizeText}</span>
    <span class="pill">{preview.pivotText}</span>
  </header>
  <div class="stage">
    <div
      class="box {preview.shape}"
      style:--swatch={color}
      style:width={`${preview.box.w}px`}
      style:height={`${preview.box.h}px`}
      style:background-size={`${preview.scale}px ${preview.scale}px`}
    >
      {#if sprite !== undefined}<span class="sprite" style={sprite}></span>{/if}
      <span class="pivot" style:left={`${preview.pivot.x}px`} style:top={`${preview.pivot.y}px`} title="pivot"></span>
      <span class="side w">{preview.box.w / preview.scale} px</span>
      <span class="side h">{preview.box.h / preview.scale} px</span>
    </div>
  </div>
  <p class="caption">Placed with its pivot on the snapped cell · {preview.scale}× zoom</p>
</section>

<style>
  .preview {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  h2 {
    margin: 0;
    font: var(--text-title-15);
  }
  .swatch {
    width: 28px;
    height: 28px;
    border-radius: var(--edge);
    background: color-mix(in srgb, var(--swatch) 30%, transparent);
    box-shadow: inset 0 0 0 2px var(--swatch);
  }
  .pill {
    padding: 2px var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge);
    color: var(--color-text-dim);
    font: var(--text-mono-11);
  }
  .stage {
    display: grid;
    place-items: center;
    min-height: 320px;
    padding: var(--space-5) var(--space-6, 48px);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge);
    background-color: var(--color-bg-canvas);
    background-image:
      linear-gradient(var(--color-border-default) 1px, transparent 1px),
      linear-gradient(90deg, var(--color-border-default) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  .box {
    position: relative;
    border: 1.5px solid var(--swatch);
    background: color-mix(in srgb, var(--swatch) 18%, transparent);
  }
  .box.ellipse {
    border-radius: 50%;
  }
  .box.point {
    border-style: dashed;
    background: transparent;
  }
  .sprite {
    position: absolute;
    inset: 0;
    image-rendering: pixelated;
  }
  .pivot {
    position: absolute;
    width: 12px;
    height: 12px;
    margin: -6px 0 0 -6px;
    border: 2px solid var(--color-text-primary);
    border-radius: 50%;
    background: var(--color-accent-default);
  }
  .side {
    position: absolute;
    color: var(--color-text-dim);
    font: var(--text-mono-11);
    white-space: nowrap;
  }
  .side.w {
    top: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%);
  }
  .side.h {
    top: 50%;
    left: calc(100% + 6px);
    transform: translateY(-50%);
  }
  .caption {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
