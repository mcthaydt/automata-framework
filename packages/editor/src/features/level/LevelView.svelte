<!--
  The Level view. The panel holds the layers above the palette; the toolbar sits over the canvas; the canvas is the
  Pixi level canvas with the kit's gesture recogniser on it, feeding the level editor through the
  session (`level-session.ts`) and the gesture map (`level-gestures.ts`). Everything that decides is plain TypeScript;
  this file draws and forwards. One stroke is one undo step; a cancelled pointer leaves nothing; a locked or hidden
  layer says so over the canvas instead of ignoring the pen without a word. It also holds the inspector (Entity, Level, Checks), the dock of level cards and the keyboard shortcuts, each also a visible control. The regions are components that take the session (`LevelPanel`, `LevelStage`, `LevelInspector`, `LevelCards`), so the editor suite
  mounts the same regions over a session it keeps; this view makes its own session and places them in its own shell.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import EditorShell from '../../shared/kit/shell/EditorShell.svelte'
import { defaultDockOpen, dockPlacementOf, shellModeOf } from '../../shared/kit/shell/shell-mode'
import { projectHistory } from '../../shared/level-2d/editor/edit-history'
import type { Project } from '../../shared/level-2d/model/project-types'
import type { ViewProps } from '../../shared/level-2d/session/view-props'
import LevelCards from './LevelCards.svelte'
import LevelDock from './LevelDock.svelte'
import LevelInspector from './LevelInspector.svelte'
import LevelPanel from './LevelPanel.svelte'
import LevelStage from './LevelStage.svelte'
import { levelFocus } from './level-focus'
import { createLevelSession } from './level-session'

const { geometry, document: opened, frame, services, focus }: ViewProps = $props()

// The view is made for one document: the screen remounts it when the document is replaced (Take theirs).
// svelte-ignore state_referenced_locally
const located = projectHistory(opened.history)
// svelte-ignore state_referenced_locally
const session = createLevelSession({
  history: opened.history,
  ids: services.ids,
  focus: focus === undefined || located === undefined ? undefined : levelFocus(located.state, focus),
})
// svelte-ignore state_referenced_locally
const history = opened.history

let panelOpen = $state(false)
let inspectorOpen = $state(false)
/** `undefined` follows the shell's default for the size. */
let dockOpen = $state<boolean | undefined>()

const mode = $derived(shellModeOf(geometry.current.formFactor))
const wide = $derived(mode === 'wide')
const dockIsSheet = $derived(dockPlacementOf(mode, geometry.current.heightTier) !== 'inline')
const dockShown = $derived(dockOpen ?? defaultDockOpen(mode, geometry.current.heightTier))

onDestroy(() => session?.dispose())
</script>

<EditorShell
  {geometry}
  topbar={frame.topbar}
  rail={frame.rail}
  status={frame.status}
  sheets={frame.sheets}
  bind:panelOpen
  bind:inspectorOpen
  bind:dockOpen
  testId="level-view"
>
  {#snippet panel()}
    {#if session !== undefined}
      <LevelPanel {session} {history} read={services.read} objectUrls={services.objectUrls} />
    {/if}
  {/snippet}

  {#snippet canvas()}
    {#if session === undefined}
      <div class="refused" role="status">
        <h2>This document can’t be shown as a level</h2>
        <p>It has no level to draw. Your file is unchanged.</p>
      </div>
    {:else}
      <LevelStage
        {session}
        {history}
        read={services.read}
        ids={services.ids}
        canvas={services.canvas}
        onundo={services.onundo}
        onredo={services.onredo}
        showLayers={!wide}
        layersOpen={panelOpen}
        onlayers={() => (panelOpen = !panelOpen)}
        showInspector={!wide}
        {inspectorOpen}
        oninspector={() => (inspectorOpen = !inspectorOpen)}
        showLevels={dockIsSheet}
        levelsOpen={dockShown}
        onlevels={() => (dockOpen = !dockShown)}
      />
    {/if}
  {/snippet}

  {#snippet inspector()}
    {#if session !== undefined}
      <LevelInspector
        {session}
        {history}
        ids={services.ids}
        check={(project: Project) => opened.profile.check(project, {})}
      />
    {/if}
  {/snippet}

  {#snippet dock()}
    {#if session !== undefined}
      <LevelCards {session} {history} />
    {:else}
      <LevelDock cards={[]} onopen={() => {}} />
    {/if}
  {/snippet}
</EditorShell>

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
