<!--
  The World view (plan ED2D.6b; 2D editor spec §8, the World row, flow 7; mockup `world`): the panel holds the world's
  layout switch and its levels as a list; the canvas is the map, where a level is pressed to select it and dragged to
  move it (one undo step; a sequence reorders and the Level view's dock follows); the inspector edits the selected
  level. The map is fitted to its box (plan decision 1); the camera holds still while a drag is under way, so the level
  stays under the finger even when the world's extent changes.
-->
<script lang="ts">
import { attachGestures, Button, EditorShell, Segmented, shellModeOf } from '@mcthaydt/automata-editor-kit'
import { untrack } from 'svelte'
import type { Camera } from '../../canvas/level-view'
import type { Project, Size, WorldLayout } from '../../model/project-types'
import { addLevel } from '../../model/world/level-edits'
import { setWorldLayout } from '../../model/world/world-layout'
import { projectHistory } from '../level/edit-history'
import type { ViewProps } from '../views/view-props'
import WorldCanvas from './WorldCanvas.svelte'
import WorldInspector from './WorldInspector.svelte'
import { createWorldCamera } from './world-camera'
import { createWorldDrag } from './world-drag'
import { worldGestures } from './world-gestures'
import { worldLinks } from './world-links'
import { fitWorld, levelAt, newLevelInput, worldRects } from './world-model'

const { geometry, document: opened, frame, services }: ViewProps = $props()

/** jsdom lays nothing out and has no `ResizeObserver`: the map keeps this box there. */
const DEFAULT_BOX: Size = { w: 800, h: 600 }
const MARGIN = 24
const LAYOUTS: readonly { id: WorldLayout; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'grid', label: 'Grid' },
  // A sequence in plain words (the APP spec's plain words for non-developers), short enough for the 264 px panel.
  { id: 'horizontal', label: 'Row' },
  { id: 'vertical', label: 'Column' },
]

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
let box = $state.raw<Size>(DEFAULT_BOX)
const worldCamera = createWorldCamera()
let moved = $state.raw<Camera | undefined>()
$effect(() => worldCamera.subscribe(() => (moved = worldCamera.camera)))
let map = $state<HTMLElement>()
let panelOpen = $state(false)
let inspectorOpen = $state(false)

const wide = $derived(shellModeOf(geometry.current.formFactor) === 'wide')

const world = $derived(project?.worlds.find((candidate) => candidate.id === worldId))
const rects = $derived(
  project === undefined || world === undefined ? [] : worldRects(project, worldId, selected),
)
const links = $derived(project === undefined ? [] : worldLinks(project, rects))
/** Until the map is measured, the fit the camera will start from. */
const camera = $derived(moved ?? fitWorld(rects, box, MARGIN))
/** Where the levels' top and bottom edges fall on the map, in CSS pixels: the layout checks read it to see them centred. */
const levelsBox = $derived(
  rects.length === 0
    ? undefined
    : `${camera.y + Math.min(...rects.map((rect) => rect.y)) * camera.scale},${camera.y + Math.max(...rects.map((rect) => rect.y + rect.h)) * camera.scale}`,
)
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

$effect(() => {
  const element = map
  const Observer = element?.ownerDocument.defaultView?.ResizeObserver
  if (element === undefined || Observer === undefined) return
  const observer = new Observer((entries) => {
    const measured = entries[0]?.contentRect
    if (measured !== undefined && measured.width > 0 && measured.height > 0)
      box = { w: Math.round(measured.width), h: Math.round(measured.height) }
  })
  observer.observe(element)
  return () => observer.disconnect()
})

// The camera follows the map's box: the first measure fits the levels, later ones keep the centre (plan ED2D.8a).
$effect(() => {
  const size = box
  untrack(() => worldCamera.measure(size, rects))
})

// The gestures go on the map once it is in the page (plan ED2D.8a decision 1).
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

/** Fits the map again once a step that moves every level (a new level, a new layout) has landed. */
function fitAfter(): void {
  queueMicrotask(() => worldCamera.fit(rects))
}

function addOne(): void {
  if (history === undefined || project === undefined) return
  const input = newLevelInput(project, worldId)
  history.apply('Add level', (current) => addLevel(current, input))
  selected = input.id
  fitAfter()
}

function layout(next: string): void {
  if (history === undefined || world === undefined || next === world.layout) return
  history.apply('Switch layout', (current) => setWorldLayout(current, worldId, next as WorldLayout))
  fitAfter()
}
</script>

<EditorShell
  {geometry}
  topbar={frame.topbar}
  rail={frame.rail}
  status={frame.status}
  sheets={frame.sheets}
  bind:panelOpen
  bind:inspectorOpen
  testId="world-view"
>
  {#snippet panel()}
    <div class="panel" data-scroll-region>
      {#if project !== undefined && project.worlds.length > 1}
        <Segmented
          label="World"
          options={project.worlds.map((candidate) => ({ id: candidate.id, label: candidate.id }))}
          bind:value={worldId}
        />
      {/if}
      {#if world !== undefined}
        <Segmented
          label="Layout"
          options={LAYOUTS}
          value={world.layout}
          onedit={(event) => layout(event.value)}
        />
      {/if}
      <ul class="levels" aria-label="Levels">
        {#each levels as level (level.id)}
          <li>
            <button type="button" aria-pressed={level.id === selected} onclick={() => (selected = level.id)}>
              {level.name}
            </button>
          </li>
        {/each}
      </ul>
      {#if history !== undefined}
        <Button onclick={addOne}>Add level</Button>
      {/if}
    </div>
  {/snippet}
  {#snippet canvas()}
    {#if history === undefined}
      <p class="empty">This document has no world to show.</p>
    {:else}
      <div class="stage">
      {#if !wide}
        <div class="drawers">
          <button type="button" aria-expanded={panelOpen} onclick={() => (panelOpen = !panelOpen)}>Levels</button>
          <button type="button" aria-expanded={inspectorOpen} onclick={() => (inspectorOpen = !inspectorOpen)}
            >Inspector</button
          >
        </div>
      {/if}
      <div
        class="map"
        role="application"
        aria-label="World map"
        data-testid="world-map"
        data-levels-box={levelsBox}
        bind:this={map}
      >
        <MapCanvas {rects} {camera} {links} />
      </div>
      <div class="fit"><Button onclick={() => worldCamera.fit(rects)}>Fit</Button></div>
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
          fitAfter()
        }}
        onremoved={() => (selected = undefined)}
      />
    {:else}
      <p class="empty">Choose a level on the map or in the list.</p>
    {/if}
  {/snippet}
</EditorShell>

<style>
  .panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: var(--space-3);
    height: 100%;
    padding: var(--space-3);
    overflow-y: auto;
  }
  .levels {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .levels button {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
  .levels button[aria-pressed='true'] {
    border-color: var(--color-accent-default);
  }
  /* Below wide the drawer buttons sit over the map; the map takes the rest of the canvas. */
  /* A column, so the map takes all the height the drawer buttons leave, with or without them (wide has none). */
  .stage {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .fit {
    position: absolute;
    inset: auto var(--space-3) var(--space-3) auto;
  }
  .drawers {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }
  .drawers button {
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
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
