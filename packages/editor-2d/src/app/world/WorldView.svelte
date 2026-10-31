<!--
  The World view (plan ED2D.6b; 2D editor spec §8, the World row, flow 7; mockup `world`): the panel holds the world's
  layout switch and its levels as a list; the canvas is the map, where a level is pressed to select it and dragged to
  move it (one undo step; a sequence reorders and the Level view's dock follows); the inspector edits the selected
  level. The map is fitted to its box (plan decision 1); the camera holds still while a drag is under way, so the level
  stays under the finger even when the world's extent changes.
-->
<script lang="ts">
import { EditorShell, Segmented } from '@mcthaydt/automata-editor-kit'
import type { Camera } from '../../canvas/level-view'
import type { Project, Size, WorldLayout } from '../../model/project-types'
import { setWorldLayout } from '../../model/world/world-layout'
import { projectHistory } from '../level/edit-history'
import type { ViewProps } from '../views/view-props'
import WorldCanvas from './WorldCanvas.svelte'
import WorldInspector from './WorldInspector.svelte'
import { createWorldDrag } from './world-drag'
import { fitWorld, worldRects } from './world-model'

const { geometry, document: opened, frame, services }: ViewProps = $props()

/** jsdom lays nothing out and has no `ResizeObserver`: the map keeps this box there. */
const DEFAULT_BOX: Size = { w: 800, h: 600 }
const MARGIN = 24
const LAYOUTS: readonly { id: WorldLayout; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'grid', label: 'Grid' },
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'vertical', label: 'Vertical' },
]

// The view is made for one document: the screen remounts it when the document is replaced.
// svelte-ignore state_referenced_locally
const history = projectHistory(opened.history)
// svelte-ignore state_referenced_locally
const Map = services.worldCanvas ?? WorldCanvas

// svelte-ignore state_referenced_locally
let project = $state.raw<Project | undefined>(history?.state)
$effect(() => opened.history.subscribe(() => (project = history?.state)))

// svelte-ignore state_referenced_locally
let worldId = $state(history?.state.worlds[0]?.id ?? '')
let selected = $state<string | undefined>()
let box = $state.raw<Size>(DEFAULT_BOX)
/** The camera a drag started with, kept until it ends. */
let held = $state.raw<Camera | undefined>()
let map = $state<HTMLElement>()

const world = $derived(project?.worlds.find((candidate) => candidate.id === worldId))
const rects = $derived(
  project === undefined || world === undefined ? [] : worldRects(project, worldId, selected),
)
const fitted = $derived(fitWorld(rects, box, MARGIN))
const camera = $derived(held ?? fitted)
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

function pointOf(event: PointerEvent): { x: number; y: number } {
  const bounds = map?.getBoundingClientRect()
  return { x: event.clientX - (bounds?.left ?? 0), y: event.clientY - (bounds?.top ?? 0) }
}

function down(event: PointerEvent): void {
  if (event.button !== 0 || drag === undefined) return
  try {
    map?.setPointerCapture?.(event.pointerId)
  } catch {
    // jsdom and a pointer that is already gone: the drag still works while the pointer stays over the map.
  }
  held = fitted
  drag.down(pointOf(event))
}

function up(): void {
  drag?.up()
  held = undefined
}

function cancel(): void {
  drag?.cancel()
  held = undefined
}

function layout(next: string): void {
  if (history === undefined || world === undefined || next === world.layout) return
  history.apply('Switch layout', (current) => setWorldLayout(current, worldId, next as WorldLayout))
}
</script>

<EditorShell
  {geometry}
  topbar={frame.topbar}
  rail={frame.rail}
  status={frame.status}
  sheets={frame.sheets}
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
    </div>
  {/snippet}
  {#snippet canvas()}
    {#if history === undefined}
      <p class="empty">This document has no world to show.</p>
    {:else}
      <div
        class="map"
        role="application"
        aria-label="World map"
        data-testid="world-map"
        bind:this={map}
        onpointerdown={down}
        onpointermove={(event) => drag?.move(pointOf(event))}
        onpointerup={up}
        onpointercancel={cancel}
      >
        <Map {rects} {camera} />
      </div>
    {/if}
  {/snippet}
  {#snippet inspector()}
    {#if project !== undefined && history !== undefined && selected !== undefined}
      <WorldInspector {project} level={selected} {history} />
    {:else}
      <p class="empty">Choose a level on the map or in the list.</p>
    {/if}
  {/snippet}
</EditorShell>

<style>
  .panel {
    display: grid;
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
  .map {
    width: 100%;
    height: 100%;
    touch-action: none;
  }
  .empty {
    margin: 0;
    padding: var(--space-4);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
