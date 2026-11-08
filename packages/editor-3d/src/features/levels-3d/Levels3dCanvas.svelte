<!--
  The room's picture in the suite (spec 10.3): the Plan, the 3D view or Walk, whichever the view control in the top bar
  has chosen. The choice is the level editor's own view mode, so it is kept with the plan's camera and layer when the
  suite switches to another editor and back. The top bar owns Undo and Redo, so the views' multi-finger taps leave them
  to it.
-->
<script lang="ts">
import type { LevelEditor } from '../../shared/edit/level-editor'
import DollhouseCanvas from './dollhouse/DollhouseCanvas.svelte'
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
</script>

{#if mode === 'walk'}
  <WalkCanvas
    {editor}
    renderer={session.dollhouse}
    frames={session.frames}
    onundo={leave}
    onredo={leave}
    onwords={(words) => (pointer.walkWords = words)}
  />
{:else if mode === 'dollhouse' || mode === 'split'}
  <DollhouseCanvas {editor} renderer={session.dollhouse} onundo={leave} onredo={leave} />
{:else}
  <PlanCanvas
    {editor}
    tools={planToolsOf(editor)}
    renderer={session.renderer}
    onundo={leave}
    onredo={leave}
    onpointer={(at) => (pointer.at = at)}
  />
{/if}
