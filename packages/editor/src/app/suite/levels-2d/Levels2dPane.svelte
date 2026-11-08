<!--
  One region of Levels 2D in the suite's shell, drawn from the view the person chose: the level's, the game's tiles or its characters.
  The session holds both views' state, so a switch and return finds the level, layer, tool, selection and camera, and
  the tile and rule that were chosen, as they were. On the try-it sample with no level yet, the canvas offers the
  starting points instead, and the same pane becomes the level when one is chosen.
-->
<script lang="ts">
import CharactersInspector from '../../../features/characters/CharactersInspector.svelte'
import CharactersPanel from '../../../features/characters/CharactersPanel.svelte'
import CharactersStage from '../../../features/characters/CharactersStage.svelte'
import TemplateRow from '../../../features/home/TemplateRow.svelte'
import LevelInspector from '../../../features/level/LevelInspector.svelte'
import LevelPanel from '../../../features/level/LevelPanel.svelte'
import LevelStage from '../../../features/level/LevelStage.svelte'
import TilesInspector from '../../../features/tiles/TilesInspector.svelte'
import TilesPanel from '../../../features/tiles/TilesPanel.svelte'
import TilesStage from '../../../features/tiles/TilesStage.svelte'
import Levels2dConflict from './Levels2dConflict.svelte'
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
// svelte-ignore state_referenced_locally
const current = session.current
const read = (path: string) => session.read(path)
const open = $derived($current.kind === 'open' ? $current : undefined)
// svelte-ignore state_referenced_locally
const refused = session.refused
let starting = $state(false)

async function start(profileId: string, templateId: string): Promise<void> {
  starting = true
  try {
    await session.start(profileId, templateId)
  } finally {
    starting = false
  }
}
</script>

{#if open !== undefined}
  {#if $view === 'characters'}
    {#if part === 'panel'}
      <CharactersPanel session={open.characters} />
    {:else if part === 'canvas'}
      <CharactersStage session={open.characters} {read} objectUrls={session.options.objectUrls} />
      <Levels2dConflict {session} />
    {:else}
      <CharactersInspector
        session={open.characters}
        {read}
        objectUrls={session.options.objectUrls}
        files={session.files}
      />
    {/if}
  {:else if $view === 'tiles'}
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
      <Levels2dConflict {session} />
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
    <Levels2dConflict {session} />
  {:else}
    <LevelInspector session={open.level} history={open.history} ids={session.options.ids} />
  {/if}
{:else if part === 'canvas' && $current.kind === 'empty'}
  <div class="starts" data-testid="levels-2d-starts">
    <h2>New level</h2>
    <p>Pick a starting point. You can change everything later.</p>
    <TemplateRow cards={$current.cards} busy={starting} oncreate={(profile, template) => void start(profile, template)} />
    {#if $refused !== undefined}<p role="alert">Not made: {$refused}</p>{/if}
  </div>
{:else if part === 'canvas' && $current.kind === 'error'}
  <div class="refused" role="status" data-testid="levels-2d-refused">
    <h2>{$current.message}</h2>
    {#each $current.errors as error, index (index)}<p>{error.message}</p>{/each}
    <p>Your file is unchanged.</p>
  </div>
{/if}

<style>
  /* The starting points: one column that scrolls on its own when a phone is short, never wider than a card needs. */
  .starts {
    box-sizing: border-box;
    max-width: 480px;
    height: 100%;
    padding: var(--space-5);
    overflow-y: auto;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .starts h2 {
    margin: 0 0 var(--space-2);
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  .starts p {
    margin: 0 0 var(--space-3);
  }
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
