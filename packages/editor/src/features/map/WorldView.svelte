<!--
  The Map view (the world): the panel holds the world's
  layout switch and its levels as a list; the canvas is the map, with the Level view's frame (spec 11.4): one pill
  floats over it with Details below `wide` and All levels in the compact layout (they open the inspector and the list) and
  Fit, at the map's top from an iPad up and at its foot on a phone. The map is where a level is pressed to select it and dragged to
  move it (one undo step; a sequence reorders and the level picker follows); the inspector edits the selected
  level. The map is fitted to its box (plan decision 1); the camera holds still while a drag is under way, so the level
  stays under the finger even when the world's extent changes.
-->
<script lang="ts">
import { attachGestures } from '../../shared/kit/gestures/attach-gestures'
import EditorShell from '../../shared/kit/shell/EditorShell.svelte'
import StagePill from '../../shared/kit/shell/StagePill.svelte'
import { shellModeAt } from '../../shared/kit/shell/shell-mode'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
import type { Camera } from '../../shared/level-2d/canvas/level-view'
import { projectHistory } from '../../shared/level-2d/model/edit-history'
import type { Project, WorldLayout } from '../../shared/level-2d/model/project-types'
import { addLevel } from '../../shared/level-2d/model/world/level-edits'
import { setWorldLayout } from '../../shared/level-2d/model/world/world-layout'
import { worldLinks } from '../../shared/level-2d/model/world/world-links'
import {
  fitWorld,
  levelAt,
  levelsOnScreen,
  newLevelInput,
  worldRects,
} from '../../shared/level-2d/model/world/world-model'
import type { ViewProps } from '../document/view-props'
import WorldCanvas from './WorldCanvas.svelte'
import WorldInspector from './WorldInspector.svelte'
import WorldPanel from './WorldPanel.svelte'
import { createWorldCamera } from './world-camera'
import { createWorldDrag } from './world-drag'
import { worldFit } from './world-fit.svelte'
import { worldGestures } from './world-gestures'

const { geometry, document: opened, frame, services }: ViewProps = $props()

const MARGIN = 24

// The view is made for one document: the screen remounts it when the document is replaced.
// svelte-ignore state_referenced_locally
const history = projectHistory(opened.history)
// svelte-ignore state_referenced_locally
const MapCanvas = services.worldCanvas ?? WorldCanvas

// svelte-ignore state_referenced_locally
let project = $state.raw<Project | undefined>(history?.state)
$effect(() => opened.history.subscribe(() => (project = history?.state)))

// svelte-ignore state_referenced_locally
let worldId = $state(history?.state.worlds[0]?.id ?? '')
let selected = $state<string | undefined>()
const worldCamera = createWorldCamera()
let moved = $state.raw<Camera | undefined>()
$effect(() => worldCamera.subscribe(() => (moved = worldCamera.camera)))
let map = $state<HTMLElement>()
let panelOpen = $state(false)
let inspectorOpen = $state(false)

const mode = $derived(shellModeAt(geometry.current))
const wide = $derived(mode === 'wide')

// The map's box and what covers it, and the camera's fit to them (`world-fit`).
const fit = worldFit({
  map: () => map,
  camera: worldCamera,
  rects: () => rects,
  wide: () => wide,
  covers: () => [panelOpen, inspectorOpen],
})

const world = $derived(project?.worlds.find((candidate) => candidate.id === worldId))
const rects = $derived(
  project === undefined || world === undefined ? [] : worldRects(project, worldId, selected),
)
const links = $derived(project === undefined ? [] : worldLinks(project, rects))
/** Until the map is measured, the fit the camera will start from. */
const camera = $derived(moved ?? fitWorld(rects, fit.box, MARGIN))
/** Where the levels' edges fall on the map: the layout checks read them to see every level in view and centred. */
const onScreen = $derived(levelsOnScreen(rects, camera))
const levels = $derived(
  project === undefined || world === undefined
    ? []
    : world.placements.flatMap(
        (placement) => project?.levels.find((level) => level.id === placement.level) ?? [],
      ),
)

// svelte-ignore state_referenced_locally
const drag =
  history === undefined
    ? undefined
    : createWorldDrag({
        history,
        world: () => worldId,
        camera: () => camera,
        onselect: (level) => (selected = level),
      })

// The gestures go on the map once it is in the page.
$effect(() => {
  const element = map
  if (element === undefined || drag === undefined) return
  const target = {
    levelAt: (screen: { x: number; y: number }) => levelAt(rects, worldCamera.toWorld(screen)),
    drag,
    panBy: (dx: number, dy: number) => worldCamera.panBy(dx, dy),
    zoomAt: (point: { x: number; y: number }, factor: number) => worldCamera.zoomAt(point, factor),
  }
  return attachGestures(element, worldGestures(target, services))
})

function addOne(): void {
  if (history === undefined || project === undefined) return
  const input = newLevelInput(project, worldId)
  history.apply('Add level', (current) => addLevel(current, input))
  selected = input.id
  fit.fitAfter()
}

function layout(next: WorldLayout): void {
  if (history === undefined || world === undefined || next === world.layout) return
  history.apply('Switch layout', (current) => setWorldLayout(current, worldId, next))
  fit.fitAfter()
}
</script>

<EditorShell
  {geometry}
  topbar={frame.topbar}
  sheets={frame.sheets}
  bind:panelOpen
  bind:inspectorOpen
  testId="world-view"
>
  {#snippet panel()}
    <WorldPanel
      {project}
      bind:worldId
      {world}
      {levels}
      bind:selected
      onadd={history === undefined ? undefined : addOne}
      onlayout={layout}
    />
  {/snippet}
  {#snippet canvas()}
    {#if history === undefined}
      <p class="empty">This document has no world to show.</p>
    {:else}
      <div class="stage">
        <div
          class="map"
          role="application"
          aria-label="World map"
          data-testid="world-map"
          data-levels-box={onScreen?.down}
          data-levels-span={onScreen?.across}
          bind:this={map}
        >
          {#if project !== undefined}<MapCanvas {project} read={services.read} {rects} {camera} {links} />{/if}
        </div>
        <StagePill label="Map controls" at={mode === 'compact' ? 'dock' : 'top'}>
          {#if !wide}
            {#if mode === 'compact'}
              <IconButton
                icon="list"
                label="All levels"
                showLabel
                aria-expanded={panelOpen}
                onclick={() => (panelOpen = !panelOpen)}
              />
            {/if}
            <IconButton
              icon="inspector"
              label="Details"
              showLabel
              aria-expanded={inspectorOpen}
              onclick={() => (inspectorOpen = !inspectorOpen)}
            />
          {/if}
          <IconButton icon="fit" label="Fit the map in view" onclick={() => worldCamera.fit(rects, fit.openArea())} />
        </StagePill>
      </div>
    {/if}
  {/snippet}
  {#snippet inspector()}
    {#if project !== undefined && history !== undefined && selected !== undefined}
      <WorldInspector
        {project}
        level={selected}
        {history}
        ids={services.ids}
        onadded={(level) => {
          selected = level
          fit.fitAfter()
        }}
        onremoved={() => (selected = undefined)}
      />
    {:else}
      <p class="empty">Tap a level to edit it.</p>
    {/if}
  {/snippet}
</EditorShell>

<style>
  /* The map fills the stage; the controls float over it in the kit's pill, as the Level view's tools do. */
  .stage {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .map {
    flex: 1 1 0;
    min-height: 0;
    touch-action: none;
  }
  .empty {
    margin: 0;
    padding: var(--space-4);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
