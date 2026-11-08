<!--
  One region of Levels 2D in the suite's shell, drawn from the view the person chose: the level's, or the game's tiles.
  The session holds both views' state, so a switch and return finds the level, layer, tool, selection and camera, and
  the tile and rule that were chosen, as they were.
-->
<script lang="ts">
import LevelInspector from '../../../features/level/LevelInspector.svelte'
import LevelPanel from '../../../features/level/LevelPanel.svelte'
import LevelStage from '../../../features/level/LevelStage.svelte'
import TilesInspector from '../../../features/tiles/TilesInspector.svelte'
import TilesPanel from '../../../features/tiles/TilesPanel.svelte'
import TilesStage from '../../../features/tiles/TilesStage.svelte'
import type { Levels2dSession } from './levels-2d-session'

interface Props {
  session: Levels2dSession
  part: 'panel' | 'canvas' | 'inspector'
}

const { session, part }: Props = $props()

// svelte-ignore state_referenced_locally
const view = session.view
// svelte-ignore state_referenced_locally
const adding = session.adding
const read = (path: string) => session.read(path)
const open = $derived(session.state.kind === 'open' ? session.state : undefined)
</script>

{#if open !== undefined}
  {#if $view === 'tiles'}
    {#if part === 'panel'}
      <TilesPanel
        session={open.tiles}
        {read}
        objectUrls={session.options.objectUrls}
        onaddtiles={session.files === undefined ? undefined : () => adding.set(true)}
      />
    {:else if part === 'canvas'}
      <TilesStage
        session={open.tiles}
        {read}
        objectUrls={session.options.objectUrls}
        files={session.files}
        bind:adding={$adding}
      />
    {:else}
      <TilesInspector session={open.tiles} {read} objectUrls={session.options.objectUrls} />
    {/if}
  {:else if part === 'panel'}
    <LevelPanel session={open.level} history={open.history} {read} objectUrls={session.options.objectUrls} />
  {:else if part === 'canvas'}
    <LevelStage
      session={open.level}
      history={open.history}
      {read}
      ids={session.options.ids}
      canvas={session.options.canvas}
    />
  {:else}
    <LevelInspector session={open.level} history={open.history} ids={session.options.ids} />
  {/if}
{:else if part === 'canvas' && session.state.kind === 'error'}
  <div class="refused" role="status" data-testid="levels-2d-refused">
    <h2>{session.state.message}</h2>
    {#each session.state.errors as error, index (index)}<p>{error.message}</p>{/each}
    <p>Your file is unchanged.</p>
  </div>
{/if}

<style>
  .refused {
    padding: var(--space-5);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .refused h2 {
    margin: 0 0 var(--space-2);
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  .refused p {
    margin: 0;
  }
</style>
