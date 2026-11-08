<!--
  The Levels 3D regions in the editor suite's shell (plan EDS.2d; editor suite spec §4.1, §4.7, EDS-D12): the layers
  list, the drawing tools in the top bar, the Plan view and a status line, each drawn from the level editor the suite keeps, so a switch and return finds
  the mode, layer, camera and selection as they were. The suite owns the top bar (Undo and Redo among it); the
  inspector shows what is selected and how the checks stand.
-->
<script module lang="ts">
import Levels3dCanvas from './Levels3dCanvas.svelte'
import Levels3dInspector from './Levels3dInspector.svelte'
import Levels3dStatus from './Levels3dStatus.svelte'
import Levels3dTools from './Levels3dTools.svelte'
import type { Levels3dSuiteSession } from './levels-3d-suite-editor'
import EditorLayers from './plan/EditorLayers.svelte'

export { canvas, inspector, panel, status, tools }
</script>

{#snippet panel(session: Levels3dSuiteSession)}
  {#if session.level.state.kind === 'open'}
    <EditorLayers editor={session.level.state.editor} />
  {/if}
{/snippet}

{#snippet canvas(session: Levels3dSuiteSession)}
  {#if session.level.state.kind === 'open'}
    <Levels3dCanvas {session} editor={session.level.state.editor} />
  {:else}
    <div class="refused" role="status" data-testid="levels-3d-refused">
      <h2>{session.level.state.message}</h2>
      <p>{session.level.state.reason}</p>
      <p>Your file is unchanged.</p>
      {#if session.level.state.details.length > 0}
        <details>
          <summary>Details</summary>
          {#each session.level.state.details as issue, index (index)}<p class="detail">{issue.message}</p>{/each}
        </details>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet inspector(session: Levels3dSuiteSession)}
  {#if session.level.state.kind === 'open' && session.checks !== undefined}
    <Levels3dInspector editor={session.level.state.editor} checks={session.checks} />
  {/if}
{/snippet}

{#snippet tools(session: Levels3dSuiteSession)}
  <Levels3dTools {session} />
{/snippet}

{#snippet status(session: Levels3dSuiteSession)}
  <Levels3dStatus {session} />
{/snippet}

<style>
  .refused {
    padding: var(--space-5);
    color: var(--stage-ink);
    font: var(--text-body-13);
  }
  .refused h2 {
    margin: 0 0 var(--space-2);
    color: var(--stage-ink);
    font: var(--text-title-15);
  }
  .refused p {
    margin: 0 0 var(--space-2);
  }
  /* The stage is dark; the muted ink is still at least 4.5:1 on it. */
  .refused .detail {
    color: var(--stage-muted);
  }
  .refused summary {
    min-height: var(--size-hit);
    display: flex;
    align-items: center;
    cursor: pointer;
  }
</style>
