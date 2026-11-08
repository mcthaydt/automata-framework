<!--
  The Tiles view's stage in the suite's shell: the selected tileset as tiles with its tags, above the live preview of
  the selected rule, and the Add tiles dialog. The shell owns the panel and details toggles, so the stage has no pill.
  With no tiles yet it says so and offers Add tiles as its one primary action.
-->
<script lang="ts">
import type { ProjectStore } from '../../shared/kit/storage/project-store'
import Button from '../../shared/kit/widgets/Button.svelte'
import type { ObjectUrls } from '../../shared/level-2d/documents/view-props'
import AddTilesDialog from './AddTilesDialog.svelte'
import RulePreview from './RulePreview.svelte'
import { rulePreview } from './rule-preview'
import TilesetSheet from './TilesetSheet.svelte'
import { tileImages, tilesState } from './tiles-state.svelte'
import type { TilesetsSession } from './tilesets-session'

interface Props {
  session: TilesetsSession
  read: (path: string) => Promise<Uint8Array | undefined>
  objectUrls?: ObjectUrls | undefined
  /** Where Add tiles writes its picture; without it there is no Add tiles. */
  files?: Pick<ProjectStore, 'list' | 'write'> | undefined
  /** Whether the Add tiles dialog is open (the panel's button opens it too). */
  adding: boolean
}

let { session, read, objectUrls, files, adding = $bindable() }: Props = $props()

// svelte-ignore state_referenced_locally
const tiles = tilesState(session)
// svelte-ignore state_referenced_locally
const pictures = tileImages(() => tiles.project, read, objectUrls)

const tileset = $derived(tiles.project.defs.tilesets.find((set) => set.id === tiles.selection.tileset))
const preview = $derived(
  tiles.selection.layer === undefined || tiles.selection.value === undefined
    ? undefined
    : rulePreview(tiles.project, tiles.selection.layer, tiles.selection.value, tiles.selection.rule),
)
</script>

<div class="stage" data-scroll-region data-testid="tilesets-view">
  {#if tileset === undefined}
    <div class="none">
      <p role="status">No tiles yet. Add a picture of your tiles to paint with them.</p>
      {#if files !== undefined}<Button variant="primary" onclick={() => (adding = true)}>Add tiles</Button>{/if}
    </div>
  {:else}
    <TilesetSheet
      {tileset}
      selection={tiles.selection}
      {session}
      images={pictures.images}
      imageUrl={pictures.imageUrl}
    />
  {/if}
  {#if preview !== undefined}
    <RulePreview
      {preview}
      project={tiles.project}
      selection={tiles.selection}
      images={pictures.images}
      imageUrl={pictures.imageUrl}
    />
  {/if}
</div>
{#if files !== undefined}
  <AddTilesDialog
    bind:open={adding}
    taken={tiles.project.defs.tilesets.map((set) => set.id)}
    {files}
    onadd={(def) => session.addTileset(def)}
  />
{/if}

<style>
  /* The stage scrolls inside the shell's canvas; it is a page of words and pictures, not a canvas, so it takes the
     tool chrome's light field. The pictures keep their own dark frames. */
  .stage {
    display: grid;
    align-content: start;
    gap: var(--space-4);
    height: 100%;
    padding: var(--space-3) var(--space-4) var(--space-5);
    overflow: auto;
    overscroll-behavior: contain;
    background: var(--bg);
  }
  .none {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
    margin: 0;
    padding: var(--space-5);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .none p {
    margin: 0;
  }
</style>
