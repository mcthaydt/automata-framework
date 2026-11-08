<!--
  The room's picture in the suite (spec 10.3): the Plan, the 3D view or Walk, whichever the view control in the top bar
  has chosen. The choice is the level editor's own view mode, so it is kept with the plan's camera and layer when the
  suite switches to another editor and back. The top bar owns Undo and Redo, so the views' multi-finger taps leave them
  to it.
-->
<script lang="ts">
import { shellModeOf } from '@automata/editor/kit'
import type { LevelEditor } from '../../shared/edit/level-editor'
import { gameColours } from '../../shared/level-session/materials'
import DollhouseCanvas from './dollhouse/DollhouseCanvas.svelte'
import { createSceneCache } from './dollhouse/scene-cache'
import Levels3dToolRail from './Levels3dToolRail.svelte'
import Levels3dViewControl from './Levels3dViewControl.svelte'
import type { Levels3dSuiteSession } from './levels-3d-suite-editor'
import PlanCanvas from './plan/PlanCanvas.svelte'
import { planToolsOf } from './plan-tools-of'
import { pointerOf } from './pointer.svelte'
import WalkCanvas from './walk/WalkCanvas.svelte'

interface Props {
  session: Levels3dSuiteSession
  editor: LevelEditor<unknown>
}

const { session, editor }: Props = $props()

// svelte-ignore state_referenced_locally
const pointer = pointerOf(session)
// svelte-ignore state_referenced_locally
let mode = $state(editor.view.state.mode)
$effect(() => editor.view.subscribe((state) => (mode = state.mode)))

const leave = (): void => {}
const colours = $derived(gameColours(session.level.library))
// The 3D view and Walk draw the level as the game does: its world, its things and its time of day.
const scene = $derived(createSceneCache(editor, session.level.library))

let width = $state(0)
let height = $state(0)
/** On a phone the top bar has no room for the views and tools: they float at the foot, above the plan's own controls. */
const floating = $derived(width > 0 && shellModeOf({ width, height }) === 'compact')
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

<div class="stage" class:strip={floating && mode === 'plan'}>
  {#if mode === 'walk'}
    <WalkCanvas
      {editor}
      renderer={session.dollhouse}
      frames={session.frames}
      {colours}
      {scene}
      onundo={leave}
      onredo={leave}
      onwords={(words) => (pointer.walkWords = words)}
    />
  {:else if mode === 'dollhouse' || mode === 'split'}
    <DollhouseCanvas {editor} renderer={session.dollhouse} {colours} {scene} onundo={leave} onredo={leave} />
  {:else}
    <PlanCanvas
      {editor}
      tools={planToolsOf(editor)}
      renderer={session.renderer}
      {colours}
      onundo={leave}
      onredo={leave}
      onpointer={(at) => (pointer.at = at)}
    />
  {/if}
  {#if floating}
    <div class="tool-strip" data-testid="tool-strip" data-scroll-region="both">
      <Levels3dViewControl {editor} compact />
      {#if mode === 'plan'}<Levels3dToolRail {editor} />{/if}
    </div>
  {/if}
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  /* The plan's own controls at its foot (the draw actions, the portal offers) stand above the strip. */
  .stage.strip {
    --plan-foot: 64px;
  }
  /* Each tool is as wide as its name; the strip scrolls sideways where a phone holds too few. */
  .tool-strip > :global(*) {
    flex-shrink: 0;
  }
  .tool-strip {
    position: absolute;
    z-index: 2;
    bottom: var(--space-3);
    left: 50%;
    max-width: calc(100% - 2 * var(--space-3));
    display: flex;
    align-items: center;
    gap: var(--space-1);
    overflow-x: auto;
    scrollbar-width: none;
    transform: translateX(-50%);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-lg);
    background: var(--color-bg-surface);
  }
</style>
