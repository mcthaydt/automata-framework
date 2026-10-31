<!--
  The Level view (plan ED2D.4c4a; 2D editor spec §5.9, §8 flows 1 to 3, §12, §13; mockups `level-platformer`,
  `level-portrait`). The panel holds the layers above the palette; the toolbar sits over the canvas; the canvas is the
  ED2D.4c3b Pixi level canvas with the kit's gesture recogniser on it, feeding the ED2D.4b controller through the
  session (`level-session.ts`) and the gesture map (`level-gestures.ts`). Everything that decides is plain TypeScript;
  this file draws and forwards. One stroke is one undo step; a cancelled pointer leaves nothing; a locked or hidden
  layer says so over the canvas instead of ignoring the pen without a word. ED2D.4c4b adds the inspector (Entity, Level,
  Checks), the dock of level cards and the §12 shortcuts, each also a visible control.
-->
<script lang="ts">
import {
  attachGestures,
  defaultDockOpen,
  dockPlacementOf,
  EditorShell,
  shellModeOf,
} from '@mcthaydt/automata-editor-kit'
import { type Component, onDestroy } from 'svelte'
import type { Project } from '../../model/project-types'
import LevelCanvas from '../canvas/LevelCanvas.svelte'
import type { LevelEditorView } from '../level-editor'
import type { LevelCanvasProps, ViewProps } from '../views/view-props'
import { levelCards } from './dock-model'
import { projectHistory } from './edit-history'
import { commitEdit } from './field-commit'
import Inspector from './Inspector.svelte'
import LayersPanel from './LayersPanel.svelte'
import LevelDock from './LevelDock.svelte'
import LevelToolbar from './LevelToolbar.svelte'
import { levelFocus } from './level-focus'
import { levelGestures } from './level-gestures'
import { createLevelSession } from './level-session'
import { type LevelShortcut, shortcutFor } from './level-shortcuts'
import Palette from './Palette.svelte'
import { type PaletteItem, paletteOf } from './palette-model'
import { deleteSelected, duplicateSelected, nudgeSelected } from './selection-edits'

type CanvasComponent = Component<LevelCanvasProps>

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
const Canvas: CanvasComponent = services.canvas ?? LevelCanvas
// svelte-ignore state_referenced_locally
const history = opened.history
/** The same history as the Level view's edits; `undefined` when the document is not a level project. */
const edits = session === undefined ? undefined : projectHistory(history)

let view = $state.raw<LevelEditorView | undefined>(session?.editor.view)
let project = $state.raw<Project | undefined>(session === undefined ? undefined : (history.state as Project))
let camera = $state.raw(session?.camera)
let panelOpen = $state(false)
let inspectorOpen = $state(false)
/** `undefined` follows the shell's default for the size. */
let dockOpen = $state<boolean | undefined>()
let host = $state<HTMLElement>()
/** Object URLs of the tileset images the palette shows, by workspace path. */
let urls = $state.raw<ReadonlyMap<string, string>>(new Map())

const stops: (() => void)[] = []
if (session !== undefined) {
  stops.push(
    session.editor.subscribe(() => (view = session.editor.view)),
    session.subscribe(() => (camera = session.camera)),
    history.subscribe(() => (project = history.state as Project)),
  )
}

const mode = $derived(shellModeOf(geometry.current.formFactor))
const wide = $derived(mode === 'wide')
const dockIsSheet = $derived(dockPlacementOf(mode, geometry.current.heightTier) !== 'inline')
const dockShown = $derived(dockOpen ?? defaultDockOpen(mode, geometry.current.heightTier))
const diagnostics = $derived(project === undefined ? [] : opened.profile.check(project, {}))
const cards = $derived.by(() => {
  if (project === undefined || view === undefined) return []
  const level = view.level
  const world = project.worlds.find((each) => each.placements.some((placement) => placement.level === level))
  return world === undefined ? [] : levelCards(project, world.id, level)
})
const layers = $derived(project?.defs.layers ?? [])
const layerDef = $derived(layers.find((layer) => layer.id === view?.layer))
const palette = $derived(
  project === undefined || view === undefined
    ? { items: [] }
    : paletteOf(project, view.layer, new Set(urls.keys())),
)
/** Why the tools do nothing on this layer right now, in words for the canvas. */
const blocked = $derived.by(() => {
  if (view === undefined || layerDef === undefined || view.tool === 'select') return undefined
  if (view.hidden.has(view.layer)) return `${layerDef.label} is hidden. Show it to draw.`
  if (view.locked.has(view.layer)) return `${layerDef.label} is locked. Unlock it to draw.`
  return undefined
})

function choose(item: PaletteItem): void {
  if (session === undefined) return
  if (item.kind === 'entity') session.editor.setEntityDef(item.def)
  else session.editor.setWord(item.word)
}

function openLevel(id: string): void {
  session?.editor.setLevel(id)
  session?.fit()
}

function deleteSelection(): void {
  if (edits === undefined || view === undefined || view.selected.length === 0) return
  const { level, selected } = view
  commitEdit(edits, 'Delete', (current) => deleteSelected(current, level, selected))
}

function duplicateSelection(): void {
  if (session === undefined || edits === undefined || view === undefined || view.selected.length === 0) return
  const { level, selected } = view
  let copies: readonly string[] = []
  commitEdit(edits, 'Duplicate', (current) => {
    const done = duplicateSelected(current, level, selected, services.ids)
    copies = done.copies
    return done.project
  })
  session.editor.select(copies)
}

function run(shortcut: LevelShortcut): void {
  const editor = session?.editor
  if (editor === undefined || view === undefined) return
  switch (shortcut.action) {
    case 'undo':
      services.onundo()
      break
    case 'redo':
      services.onredo()
      break
    case 'delete':
      deleteSelection()
      break
    case 'duplicate':
      duplicateSelection()
      break
    case 'tool':
      editor.setTool(shortcut.tool)
      break
    case 'brush':
      editor.setBrushSize(Math.min(8, Math.max(1, view.brushSize + shortcut.by)))
      break
    case 'nudge': {
      if (edits === undefined || view.selected.length === 0) break
      const { level, selected } = view
      commitEdit(edits, 'Move entity', (current) => nudgeSelected(current, level, selected, shortcut.by))
    }
  }
}

const isText = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === 'TEXTAREA' ||
    (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'color'))

function onKey(event: KeyboardEvent): void {
  if (event.defaultPrevented) return
  const focused = event.target instanceof Node ? event.target : null
  const shortcut = shortcutFor(event, {
    inText: isText(event.target),
    canNudge: host !== undefined && focused !== null && host.contains(focused),
  })
  if (shortcut === undefined) return
  event.preventDefault()
  run(shortcut)
}

// The gestures and the measure go on the canvas's box once it is in the page.
$effect(() => {
  const element = host
  if (element === undefined || session === undefined) return
  const stopGestures = attachGestures(element, levelGestures(session, services))
  const leave = (): void => session.editor.pointerLeave()
  element.addEventListener('pointerleave', leave)
  const Observer = element.ownerDocument.defaultView?.ResizeObserver
  const observer =
    Observer === undefined
      ? undefined
      : new Observer((entries) => {
          const box = entries[0]?.contentRect
          if (box !== undefined && box.width > 0 && box.height > 0)
            session.measure({ w: Math.round(box.width), h: Math.round(box.height) })
        })
  observer?.observe(element)
  return () => {
    stopGestures()
    element.removeEventListener('pointerleave', leave)
    observer?.disconnect()
  }
})

// Palette sprites: each tileset image is read once and shown through an object URL, let go when the view goes.
$effect(() => {
  const make = services.objectUrls
  const paths = (project?.defs.tilesets ?? []).flatMap((set) => (set.image === undefined ? [] : [set.image]))
  if (make === undefined) return
  for (const path of paths) {
    if (urls.has(path)) continue
    void services.read(path).then((bytes) => {
      if (bytes === undefined || urls.has(path)) return
      urls = new Map([...urls, [path, make.create(bytes)]])
    })
  }
})

onDestroy(() => {
  for (const stop of stops.splice(0)) stop()
  session?.dispose()
  for (const url of urls.values()) services.objectUrls?.revoke(url)
})
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
    {#if view !== undefined}
      <div class="panel">
        <LayersPanel
          {layers}
          current={view.layer}
          hidden={view.hidden}
          locked={view.locked}
          onselect={(id) => session?.editor.setLayer(id)}
          onhidden={(id, hidden) => session?.editor.setHidden(id, hidden)}
          onlocked={(id, locked) => session?.editor.setLocked(id, locked)}
        />
        <Palette
          layer={layerDef?.label ?? ''}
          items={palette.items}
          word={view.word}
          entityDef={view.entityDef}
          imageUrl={(path) => urls.get(path)}
          onchoose={choose}
        />
      </div>
    {/if}
  {/snippet}

  {#snippet canvas()}
    {#if session === undefined || view === undefined || project === undefined}
      <div class="refused" role="status">
        <h2>This document can’t be shown as a level</h2>
        <p>It has no level to draw. Your file is unchanged.</p>
      </div>
    {:else}
      <div class="stage">
        <LevelToolbar
          tool={view.tool}
          brushSize={view.brushSize}
          showLayers={!wide}
          layersOpen={panelOpen}
          ontool={(tool) => session.editor.setTool(tool)}
          onbrushsize={(size) => session.editor.setBrushSize(size)}
          onfit={() => session.fit()}
          onlayers={() => (panelOpen = !panelOpen)}
          showInspector={!wide}
          {inspectorOpen}
          oninspector={() => (inspectorOpen = !inspectorOpen)}
          showLevels={dockIsSheet}
          levelsOpen={dockShown}
          onlevels={() => (dockOpen = !dockShown)}
        />
        <!-- svelte-ignore a11y_no_noninteractive_tabindex: the canvas takes focus so arrows nudge the selection -->
        <div
          class="surface"
          bind:this={host}
          data-testid="level-surface"
          role="application"
          aria-label="Level canvas"
          tabindex="0"
        >
          <Canvas {project} {view} read={services.read} {camera} />
          {#if blocked !== undefined}
            <p class="blocked" role="status">{blocked}</p>
          {/if}
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet inspector()}
    {#if project !== undefined && view !== undefined && edits !== undefined}
      <Inspector
        {project}
        level={view.level}
        selected={view.selected}
        {diagnostics}
        history={edits}
        onselect={(id) => session?.editor.select([id])}
        ondelete={deleteSelection}
        onduplicate={duplicateSelection}
      />
    {/if}
  {/snippet}

  {#snippet dock()}
    <LevelDock {cards} onopen={openLevel} />
  {/snippet}
</EditorShell>

<svelte:document onkeydown={onKey} />

<style>
  .panel {
    display: grid;
    align-content: start;
  }
  .stage {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }
  .surface {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    overscroll-behavior: contain;
  }
  .blocked {
    position: absolute;
    inset: var(--space-3) auto auto 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    pointer-events: none;
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
