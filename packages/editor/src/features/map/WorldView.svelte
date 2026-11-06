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
import { untrack } from 'svelte'
import { attachGestures } from '../../shared/kit/gestures/attach-gestures'
import EditorShell from '../../shared/kit/shell/EditorShell.svelte'
import StagePill from '../../shared/kit/shell/StagePill.svelte'
import { shellModeAt } from '../../shared/kit/shell/shell-mode'
import Button from '../../shared/kit/widgets/Button.svelte'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import type { Camera } from '../../shared/level-2d/canvas/level-view'
import { projectHistory } from '../../shared/level-2d/model/edit-history'
import type { Project, Size, WorldLayout } from '../../shared/level-2d/model/project-types'
import { addLevel } from '../../shared/level-2d/model/world/level-edits'
import { setWorldLayout } from '../../shared/level-2d/model/world/world-layout'
import { worldLinks } from '../../shared/level-2d/model/world/world-links'
import {
  fitWorld,
  levelAt,
  newLevelInput,
  uncoveredArea,
  worldRects,
} from '../../shared/level-2d/model/world/world-model'
import type { ViewProps } from '../document/view-props'
import WorldCanvas from './WorldCanvas.svelte'
import WorldInspector from './WorldInspector.svelte'
import { createWorldCamera } from './world-camera'
import { createWorldDrag } from './world-drag'
import { worldGestures } from './world-gestures'

const { geometry, document: opened, frame, services }: ViewProps = $props()

/** jsdom lays nothing out and has no `ResizeObserver`: the map keeps this box there. */
const DEFAULT_BOX: Size = { w: 800, h: 600 }
const MARGIN = 24
const LAYOUTS: readonly { id: WorldLayout; label: string }[] = [
  // Plain words for each way the world arranges its levels (the grandma audit, section 5.2).
  { id: 'free', label: 'Anywhere' },
  { id: 'grid', label: 'In a grid' },
  { id: 'horizontal', label: 'In a row' },
  { id: 'vertical', label: 'In a column' },
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

const mode = $derived(shellModeAt(geometry.current))
const wide = $derived(mode === 'wide')

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
/** Where the levels' left and right edges fall on the map: the layout checks read it to see every level in view. */
const levelsSpan = $derived(
  rects.length === 0
    ? undefined
    : `${camera.x + Math.min(...rects.map((rect) => rect.x)) * camera.scale},${camera.x + Math.max(...rects.map((rect) => rect.x + rect.w)) * camera.scale}`,
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

const pageBox = (rect: DOMRect) => ({ x: rect.left, y: rect.top, w: rect.width, h: rect.height })

/**
 * The part of the map no floating inspector or open sheet covers; the whole map in wide, where nothing
 * covers it, and before the map is in the page.
 */
function openArea(): ReturnType<typeof uncoveredArea> | undefined {
  const element = map
  if (element === undefined || wide) return undefined
  const shell = element.closest('[data-testid="world-view"]')
  const covers = [
    ...(shell?.querySelectorAll<HTMLElement>(
      '[data-region="panel"][data-open="true"], [data-region="inspector"][data-open="true"]',
    ) ?? []),
  ]
  return uncoveredArea(
    pageBox(element.getBoundingClientRect()),
    covers.map((cover) => pageBox(cover.getBoundingClientRect())),
  )
}

// The camera follows the map's box and what floats over it: until the person pans or zooms it fits the levels into the part of
// the map nothing covers.
$effect(() => {
  const size = box
  untrack(() => worldCamera.measure(size, rects, openArea()))
})

// The inspector or a sheet opening or closing: measure once it is laid out, and again when its slide ends.
$effect(() => {
  void [panelOpen, inspectorOpen, wide]
  const element = map
  const page = element?.ownerDocument.defaultView
  if (element === undefined || page === undefined || page === null) return
  const refit = (): void => untrack(() => worldCamera.measure(box, rects, openArea()))
  const frame = page.requestAnimationFrame?.(refit)
  const shell = element.closest('[data-testid="world-view"]')
  const slid = (event: Event): void => {
    if ((event as TransitionEvent).propertyName === 'transform') refit()
  }
  shell?.addEventListener('transitionend', slid)
  return () => {
    if (frame !== undefined) page.cancelAnimationFrame(frame)
    shell?.removeEventListener('transitionend', slid)
  }
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

/** Fits the map again once a step that moves every level (a new level, a new layout) has landed. */
function fitAfter(): void {
  queueMicrotask(() => worldCamera.fit(rects, openArea()))
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
        <div class="arrange">
          <h2>Arrange levels</h2>
          <Segmented
            label="Arrange levels"
            options={LAYOUTS}
            value={world.layout}
            onedit={(event) => layout(event.value)}
          />
        </div>
      {/if}
      <h2>Levels</h2>
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
        <div
          class="map"
          role="application"
          aria-label="World map"
          data-testid="world-map"
          data-levels-box={levelsBox}
          data-levels-span={levelsSpan}
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
          <IconButton icon="fit" label="Fit the map in view" onclick={() => worldCamera.fit(rects, openArea())} />
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
          fitAfter()
        }}
        onremoved={() => (selected = undefined)}
      />
    {:else}
      <p class="empty">Tap a level to edit it.</p>
    {/if}
  {/snippet}
</EditorShell>

<style>
  /* Four ways in plain words do not fit one row of the 264 px panel: they wrap to two, each keeping its words. */
  .arrange :global(.segmented) {
    flex-wrap: wrap;
  }
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
  /* A section label in small capitals, as the approved mockup draws it (the Level view's Layers). The list and the
     switch keep their own accessible names as well. */
  h2 {
    margin: 0;
    padding: 0 var(--space-2);
    color: var(--muted);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  .arrange {
    display: grid;
    gap: var(--space-2);
  }
  /* Quiet rows, as the Level view's layers: no box, a wash under the pointer and on the chosen level. */
  .levels button {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
  .levels button:hover {
    background: var(--tool-hover, var(--color-bg-raised));
  }
  .levels button[aria-pressed='true'] {
    background: var(--color-accent-soft);
    font-weight: 500;
  }
  .levels button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
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
