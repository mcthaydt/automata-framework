<!--
  The Levels 2D regions in the editor suite's shell: the Level
  view's panel, canvas and inspector, and in the suite's top bar the level picker (`tools`), each drawn from the
  session the suite keeps, so a switch and return finds
  the level, layer, tool, selection and camera as they were. The suite owns the top bar (Undo and Redo among it) and the
  Panel and Details toggles, so the stage leaves those to it.
-->
<script module lang="ts">
import LevelInspector from '../../../features/level/LevelInspector.svelte'
import LevelPanel from '../../../features/level/LevelPanel.svelte'
import LevelPicker from '../../../features/level/LevelPicker.svelte'
import LevelStage from '../../../features/level/LevelStage.svelte'
import Levels2dStatus from './Levels2dStatus.svelte'
import type { Levels2dSession } from './levels-2d-session'

export { canvas, inspector, panel, status, tools }
</script>

{#snippet panel(session: Levels2dSession)}
  {#if session.state.kind === 'open'}
    <LevelPanel
      session={session.state.level}
      history={session.state.history}
      read={(path) => session.read(path)}
      objectUrls={session.options.objectUrls}
    />
  {/if}
{/snippet}

{#snippet canvas(session: Levels2dSession)}
  {#if session.state.kind === 'open'}
    <LevelStage
      session={session.state.level}
      history={session.state.history}
      read={(path) => session.read(path)}
      ids={session.options.ids}
      canvas={session.options.canvas}
    />
  {:else}
    <div class="refused" role="status" data-testid="levels-2d-refused">
      <h2>{session.state.message}</h2>
      {#each session.state.errors as error, index (index)}<p>{error.message}</p>{/each}
      <p>Your file is unchanged.</p>
    </div>
  {/if}
{/snippet}

{#snippet inspector(session: Levels2dSession)}
  {#if session.state.kind === 'open'}
    <LevelInspector
      session={session.state.level}
      history={session.state.history}
      ids={session.options.ids}
    />
  {/if}
{/snippet}

{#snippet tools(session: Levels2dSession)}
  {#if session.state.kind === 'open'}
    <LevelPicker session={session.state.level} history={session.state.history} />
  {/if}
{/snippet}

{#snippet status(session: Levels2dSession)}
  <Levels2dStatus {session} />
{/snippet}

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
