<!--
  The selected tileset as tiles: every tile
  a 44 px cell cut from the image (numbered placeholders without it), a tap adds it to or takes it from the selection,
  and the tags as toggles that mark their tiles. The selected tiles are what "Add selected tiles" puts in a rule's
  outputs and what the tag buttons tag. A refusal ("Select the tiles to tag first.") shows under the tags.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Pill from '../../shared/kit/widgets/Pill.svelte'
import type { FieldCommit } from '../../shared/level-2d/model/field-commit'
import type { TilesetDef } from '../../shared/level-2d/model/project-types'
import { tilesetTiles } from '../../shared/level-2d/model/tileset-grid'
import { tileItems } from '../../shared/level-2d/tiles/palette-model'
import { spriteStyle } from '../../shared/level-2d/tiles/tile-sprite'
import { type ResolvedSelection, tagRows } from './tilesets-model'
import type { TilesetsSession } from './tilesets-session'

interface Props {
  tileset: TilesetDef
  selection: ResolvedSelection
  session: TilesetsSession
  images: ReadonlySet<string>
  imageUrl: (path: string) => string | undefined
}

const { tileset, selection, session, images, imageUrl }: Props = $props()

const CELL = 44
const grid = $derived(tilesetTiles(tileset))
const tiles = $derived(tileItems(tileset, images))
const tags = $derived(tagRows(tileset))
const tagged = $derived(new Set(tags.find((row) => row.tag === selection.tag)?.tiles ?? []))
const picked = $derived(new Set(selection.tiles))
let message = $state<string | undefined>()
let name = $state('')

function show(result: FieldCommit): void {
  message = result.ok ? undefined : result.message
}

function addTag(event: SubmitEvent): void {
  event.preventDefault()
  const result = session.newTag(name)
  show(result)
  if (result.ok) name = ''
}
</script>

<section class="sheet" aria-labelledby="sheet-heading" data-testid="tileset-sheet">
  <header>
    <h2 id="sheet-heading">{tileset.label}</h2>
    {#if tileset.image === undefined}
      <Pill tone="warn">placeholder · generated</Pill>
    {/if}
  </header>
  <p class="meta">
    {tileset.tile.w} × {tileset.tile.h} px tiles · spacing {tileset.spacing} · padding {tileset.padding} ·
    {grid.columns} × {grid.rows} tiles
  </p>

  <div class="scroll" data-scroll-region="both">
    <div class="tiles" role="group" aria-label="Tiles" style:--columns={grid.columns}>
      {#each tiles as item (item.tile)}
        {@const drawn = item.image !== undefined && imageUrl(item.image.path) !== undefined}
        <button
          type="button"
          class="tile"
          class:tagged={tagged.has(item.tile)}
          aria-pressed={picked.has(item.tile)}
          aria-label={tagged.has(item.tile) ? `${item.label}, tagged ${selection.tag}` : item.label}
          data-tile={item.tile}
          style={spriteStyle(item, item.image === undefined ? undefined : imageUrl(item.image.path), CELL)}
          onclick={() => session.toggleTile(item.tile)}>{drawn ? '' : item.tile}</button
        >
      {/each}
    </div>
  </div>

  <div class="tags" role="group" aria-label="Tags">
    <span class="label">Tags</span>
    {#each tags as row (row.tag)}
      <button
        type="button"
        class="tag"
        aria-pressed={row.tag === selection.tag}
        onclick={() => session.select({ tag: row.tag === selection.tag ? undefined : row.tag })}
        >{row.tag} · {row.count}</button
      >
    {/each}
    {#if tags.length === 0}
      <span class="hint">No tags yet.</span>
    {/if}
  </div>

  <div class="actions">
    <span class="hint">{selection.tiles.length === 0 ? 'Tap tiles to select them.' : `${selection.tiles.length} selected`}</span>
    {#if selection.tag !== undefined}
      <Button onclick={() => show(session.tagSelected())}>Tag as {selection.tag}</Button>
      <Button onclick={() => show(session.untagSelected())}>Untag</Button>
    {/if}
    {#if selection.tiles.length > 0}
      <Button onclick={() => session.clearTiles()}>Clear selection</Button>
    {/if}
  </div>
  <form class="new-tag" onsubmit={addTag}>
    <label for="new-tag">New tag</label>
    <input id="new-tag" type="text" autocomplete="off" bind:value={name} placeholder="solid, water…" />
    <button type="submit">Add tag</button>
  </form>
  {#if message !== undefined}
    <p class="message" role="alert">{message}</p>
  {/if}
</section>

<style>
  .sheet {
    display: grid;
    gap: var(--space-2);
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
  .meta,
  .hint {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-mono-11);
  }
  .scroll {
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior: contain;
    padding-bottom: 16px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(var(--columns), var(--size-hit));
    gap: 2px;
    width: max-content;
  }
  .tile {
    position: relative;
    width: var(--size-hit);
    height: var(--size-hit);
    padding: 0;
    border: 0;
    border-radius: var(--edge-sm);
    background-repeat: no-repeat;
    image-rendering: pixelated;
    color: var(--color-text-primary);
    font: var(--text-label-12);
    text-shadow: 0 1px 1px rgb(0 0 0 / 0.6);
    cursor: pointer;
  }
  .tile.tagged::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 7px;
    height: 7px;
    border: 1px solid var(--color-bg-app);
    border-radius: var(--edge-sm);
    background: var(--color-accent-default);
  }
  .tile[aria-pressed='true'] {
    box-shadow:
      0 0 0 2px var(--color-bg-surface),
      0 0 0 4px var(--color-accent-default);
    z-index: 1;
  }
  .tile:focus-visible,
  .tag:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  .tags,
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .label {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .tag {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-dim);
    font: var(--text-label-12);
    cursor: pointer;
  }
  .tag[aria-pressed='true'] {
    border-color: color-mix(in srgb, var(--color-accent-default) 70%, transparent);
    background: var(--color-accent-soft);
    color: var(--color-accent-default);
  }
  .new-tag {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .new-tag label {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .new-tag input {
    flex: 1 1 140px;
    min-width: 0;
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .new-tag button {
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
  .message {
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
</style>
