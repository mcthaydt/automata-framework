<!--
  An opened level (plan ED3D.5c, decisions 6 to 8; the Plan view since ED3D.5d). The top bar has Back, the level's
  file, the views, the checks pill, Undo, Redo and Save; the canvas is the Plan view; the panel is the layers list (a
  drawer below `wide`, the kit's); the status line says where the pointer is, the zoom, what is selected and how the
  level stands on saving. The tool rail chooses the Plan view's tool (ED3D.6g-a), and V S X P D N, Enter, Backspace and
  Escape run the tools' commands through the kit's keymap, except while a text field has focus. An autosave on offer is asked about first; a save that found the file changed opens the kit's
  conflict dialog, and one the patch refused opens the held Save. Edits go through the document controller and the
  level editor, so this file only draws and forwards.
-->
<script lang="ts">
import {
  Button,
  ConflictDialog,
  EditorShell,
  RecoveryDialog,
  StatusLine,
  shellModeOf,
  ToastRegion,
} from '@mcthaydt/automata-editor-kit'
import { createCommandRegistry, createKeymap, type ToastStore } from '@mcthaydt/automata-editor-kit/core'
import type { GeometryState } from '@mcthaydt/automata-ui'
import { onDestroy } from 'svelte'
import { createChecksPanel, type Scheduler } from '../../app/checks-panel-controller'
import type { DocumentController, DocumentState } from '../../app/document/document-controller'
import { inspectorOf, thingRowsOf, wallRowsOf } from '../../app/inspector-cards'
import { createInspectorEdits } from '../../app/inspector-edits'
import type { MaterialTarget } from '../../app/material-session'
import { planZoom } from '../../app/plan-picture'
import { checksWords, planStatus } from '../../app/plan-status'
import { planToolCommands } from '../../app/plan-tool-commands'
import { createPlanTools, type PlanToolId } from '../../app/plan-tools'
import type { Point } from '../../format/sector.schema'
import ChecksSheet from '../checks/ChecksSheet.svelte'
import DefinitionsSheet from '../definitions/DefinitionsSheet.svelte'
import DollhouseCanvas from '../dollhouse/DollhouseCanvas.svelte'
import type { DollhouseRendererFactory } from '../dollhouse/dollhouse-renderer'
import { lazyDollhouseRenderer } from '../dollhouse/lazy-dollhouse-renderer'
import Inspector from '../inspector/Inspector.svelte'
import MaterialSheet from '../inspector/MaterialSheet.svelte'
import PortraitSheet from '../inspector/PortraitSheet.svelte'
import EditorLayers from '../plan/EditorLayers.svelte'
import PlanCanvas from '../plan/PlanCanvas.svelte'
import type { PlanRendererFactory } from '../plan/plan-renderer'
import ToolRail from '../plan/ToolRail.svelte'
import { type Frames, NO_FRAMES } from '../walk/frames'
import WalkCanvas from '../walk/WalkCanvas.svelte'
import DocumentBar from './DocumentBar.svelte'
import HeldSaveDialog from './HeldSaveDialog.svelte'

interface Props {
  geometry: GeometryState
  controller: DocumentController
  toasts: ToastStore
  /** The time an autosave's age is told against. */
  clock: { now(): number }
  /** Makes the Plan view's renderer (a dynamic import of Pixi in the page; a fake in the tests). */
  renderer: PlanRendererFactory
  /** Makes the 3D view's renderer; Pixi loaded on first use when not given (the tests pass a fake). */
  dollhouse?: DollhouseRendererFactory | undefined
  /** The frame clock the Walk view's eye moves on (the boot's); none when not given, as in the tests, which walk by hand. */
  frames?: Frames | undefined
  /** Runs the checks after the editing pauses. */
  schedule: Scheduler
  onback: () => void
}

const {
  geometry,
  controller,
  toasts,
  clock,
  renderer,
  dollhouse = lazyDollhouseRenderer(),
  frames = NO_FRAMES,
  schedule,
  onback,
}: Props = $props()

/** The controller's state right now (its store answers at once). */
function snapshot(source: DocumentController): DocumentState {
  let current: DocumentState | undefined
  source.state.subscribe((value) => {
    current = value
  })()
  if (current === undefined) throw new Error('the document controller gave no state')
  return current
}

const shellMode = $derived(shellModeOf(geometry.current.formFactor))
/**
 * The inspector column at wide needs room beside the rail, the layers and the plan: on a window narrower than this the
 * plan would be left a few hundred pixels for its toolbar, lens, pad and actions, so the column is left out and the
 * status line names what is selected (iPad mini landscape, 1133 px, keeps it; plan decision 4).
 */
const INSPECTOR_MIN_WIDTH = 1100
const inspectorShown = $derived(shellMode === 'wide' && geometry.current.layout.width >= INSPECTOR_MIN_WIDTH)
const compact = $derived(shellMode === 'compact')
/** The layers drawer (or sheet on a phone), below `wide`; at `wide` the panel is always in view. */
let panelOpen = $state(false)

// svelte-ignore state_referenced_locally
let view = $state.raw<DocumentState>(snapshot(controller))
$effect(() => controller.state.subscribe((next) => (view = next)))

// The level editor is the level's for as long as the frame shows it: the frame is made again for another level.
// svelte-ignore state_referenced_locally
const editor = view.level.editor
// svelte-ignore state_referenced_locally
const checks = createChecksPanel(editor, { schedule })
// The canvas sizes the tools once it measures itself.
// svelte-ignore state_referenced_locally
const tools = createPlanTools(editor, { w: 1, h: 1 })
const commands = createCommandRegistry()
for (const command of planToolCommands(tools, () => editor.selection.ids)) commands.register(command)
const keymap = createKeymap(
  commands,
  /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '') ? 'apple' : 'other',
)
let activeTool = $state<PlanToolId>(tools.state.tool)
const stopTools = tools.subscribe(() => (activeTool = tools.state.tool))
onDestroy(() => {
  checks.dispose()
  stopTools()
  tools.dispose()
})

/** Whether a key press is typing: focus in a field, a text area, a list or editable text. */
function inText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function onkeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return
  const handled = keymap.handle({
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    inText: inText(event.target),
  })
  if (handled) event.preventDefault()
}

// The inspector's card for what is selected (ED3D.5f), read again after each change of the level or the selection.
// svelte-ignore state_referenced_locally
const inspectorEdits = createInspectorEdits(editor)
/** The material sheet is open on this wall or surface. */
let materialTarget = $state<MaterialTarget | undefined>()
/** The definitions sheet is open. */
let definitionsOpen = $state(false)
let checksOpen = $state(false)
// svelte-ignore state_referenced_locally
let card = $state.raw(inspectorOf(editor))

/** The portrait sheet's tab, kept here so a rotation through wide comes back to it. */
let sheetTab = $state('sector')
let mode = $state(editor.view.state.mode)
// The sheet's lists follow the selection and the level, which `selection` and `card` are read again for.
const wallRows = $derived.by(() => {
  void selection
  void card
  return wallRowsOf(editor)
})
const thingRows = $derived.by(() => {
  void selection
  void card
  return thingRowsOf(editor)
})
let selection = $state.raw<readonly string[]>(editor.selection.ids)
let zoom = $state(planZoom(editor.view.state.camera))
let counts = $state.raw(checks.view)
let pointer = $state.raw<Point | undefined>(undefined)
/** What Walk says while it is shown: its warning, else what the crosshair is on. */
let walkWords = $state<string | undefined>(undefined)

$effect(() => {
  const stops = [
    editor.view.subscribe((state) => {
      mode = state.mode
      zoom = planZoom(state.camera)
    }),
    editor.selection.subscribe((next) => {
      selection = next.ids
      card = inspectorOf(editor)
    }),
    editor.history.subscribe(() => (card = inspectorOf(editor))),
    checks.subscribe(() => (counts = checks.view)),
  ]
  return () => {
    for (const stop of stops) stop()
  }
})

const pill = $derived(checksWords(counts))
const planWords = $derived(planStatus({ pointer, pxPerMetre: zoom, selection, brief: compact }))
// On a phone the bar has no room for the checks pill, so its words lead the status line.
const viewWords = $derived(mode === 'walk' && walkWords !== undefined ? walkWords : planWords)
const statusWords = $derived(compact ? `${pill.text} · ${viewWords}` : viewWords)
</script>

<svelte:window {onkeydown} />

{#snippet toolRail({ orientation }: { orientation: 'vertical' | 'horizontal' })}
  <ToolRail active={activeTool} {orientation} onchoose={(tool) => tools.choose(tool)} />
{/snippet}
{#snippet plan()}
  <PlanCanvas
    {editor}
    {tools}
    pointList={shellMode === 'wide'}
    {renderer}
    onundo={() => controller.undo()}
    onredo={() => controller.redo()}
    onpointer={(at) => (pointer = at)}
  />
{/snippet}


<!-- A phone has no tool rail: the plan there is view and select only (ED3D spec §10), and the plan keeps the height. -->
{#snippet portrait()}
  <PortraitSheet
    bind:tab={sheetTab}
    {card}
    walls={wallRows}
    things={thingRows}
    checks={pill.text}
    checksPanel={checks}
    onchange={(change, phase) => inspectorEdits.change(change, phase)}
    onselect={(id) => editor.selection.set([id])}
    onmaterial={(target) => (materialTarget = target)}
    ondefinitions={() => (definitionsOpen = true)}
  />
{/snippet}

{#snippet inspector()}
  <Inspector
    {card}
    onchange={(change, phase) => inspectorEdits.change(change, phase)}
    onmaterial={(target) => (materialTarget = target)}
    ondefinitions={() => (definitionsOpen = true)}
  />
{/snippet}

<!--
  At wide: the rail, the inspector column. Below it (ED3D.5f, the Portrait frame): the tools float over the plan's foot and
  the inspector is the bottom sheet with its tabs; a phone has neither (view and select only, spec §10).
-->
<EditorShell
  {geometry}
  bind:panelOpen
  rail={shellMode === 'wide' ? toolRail : undefined}
  inspector={inspectorShown ? inspector : undefined}
  dock={shellMode === 'medium' ? portrait : undefined}
  testId="document-frame"
>
  {#snippet topbar()}
    <DocumentBar
      heading={view.heading}
      profile={view.level.profile.id}
      canUndo={view.canUndo}
      canRedo={view.canRedo}
      undoLabel={view.undoLabel}
      redoLabel={view.redoLabel}
      busy={view.busy !== undefined}
      {compact}
      {mode}
      views={!compact}
      narrow={shellMode !== 'wide'}
      checks={pill}
      layersOpen={shellMode === 'wide' ? undefined : panelOpen}
      onlayers={() => (panelOpen = !panelOpen)}
      onchecks={() => (checksOpen = true)}
      {onback}
      onundo={() => controller.undo()}
      onredo={() => controller.redo()}
      onsave={() => controller.save()}
      onmode={(next) => editor.view.set({ mode: next })}
    />
  {/snippet}

  {#snippet panel()}
    <EditorLayers {editor} />
  {/snippet}

  {#snippet canvas()}
    <div class="stage" class:strip={shellMode === 'medium'}>
    <!-- Split puts the plan and the 3D view side by side at wide; below it the 3D modes replace the plan (spec §10). -->
    {#if mode === 'split' && shellMode === 'wide'}
      <div class="split">
        {@render plan()}
        <DollhouseCanvas {editor} renderer={dollhouse} onundo={() => controller.undo()} onredo={() => controller.redo()} />
      </div>
    {:else if mode === 'walk'}
      <WalkCanvas
        {editor}
        renderer={dollhouse}
        {frames}
        onundo={() => controller.undo()}
        onredo={() => controller.redo()}
        onwords={(words) => (walkWords = words)}
      />
    {:else if mode === 'split' || mode === 'dollhouse'}
      <DollhouseCanvas {editor} renderer={dollhouse} onundo={() => controller.undo()} onredo={() => controller.redo()} />
    {:else}
      {@render plan()}
    {/if}
    {#if shellMode === 'medium'}
      <div class="tool-strip" data-testid="tool-strip">
        <ToolRail active={activeTool} orientation="horizontal" onchoose={(tool) => tools.choose(tool)} />
      </div>
    {/if}
    </div>
  {/snippet}

  {#snippet status()}
    {#if compact}<Button data-testid="checks-open" onclick={() => (checksOpen = true)}>{pill.text}</Button>{/if}
    <StatusLine message={statusWords} save={view.save} />
  {/snippet}

  {#snippet sheets()}
    <RecoveryDialog
      path={view.level.path}
      recovery={view.recovery}
      now={clock.now()}
      busy={view.busy !== undefined}
      onrestore={() => controller.restore()}
      ondiscard={() => controller.discard()}
    />
    <ConflictDialog
      open={view.conflict}
      path={view.level.path}
      busy={view.busy !== undefined}
      onkeep={() => controller.keepMine()}
      ontake={() => controller.takeTheirs()}
      oncopy={() => controller.saveCopy()}
      oncancel={() => controller.dismissConflict()}
    />
    <HeldSaveDialog
      open={view.heldOpen}
      path={view.level.path}
      refused={view.held}
      busy={view.busy !== undefined}
      onreformat={() => controller.saveReformatted()}
      onexport={() => controller.exportCopy()}
      oncancel={() => controller.dismissHeld()}
    />
    {#if materialTarget !== undefined}
      <MaterialSheet {editor} surface={materialTarget} onclose={() => (materialTarget = undefined)} />
    {/if}
    {#if checksOpen}
      <ChecksSheet checks={checks} onclose={() => (checksOpen = false)} />
    {/if}
    {#if definitionsOpen}
      <DefinitionsSheet {editor} onclose={() => (definitionsOpen = false)} />
    {/if}
    <ToastRegion {toasts} />
  {/snippet}
</EditorShell>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  /* The plan's own controls at its foot (the draw actions, the portal offers) stand above the strip. */
  /* Above the strip, which stands above the bottom sheet's height (the shell's --dock-lift; a sheet dragged to half or
     full covers the plan on purpose). */
  .stage.strip {
    --plan-foot: calc(var(--dock-lift, 0px) + 64px);
  }
  /* In the strip each tool is as wide as its name (the rail's tab-bar sizing would squeeze "Window"). */
  .tool-strip :global(.rail[data-orientation='horizontal'] button) {
    flex: 0 0 auto;
    padding: 0 var(--space-2);
  }
  .tool-strip {
    position: absolute;
    z-index: 2;
    bottom: calc(var(--space-3) + var(--dock-lift, 0px));
    left: 50%;
    max-width: calc(100% - 2 * var(--space-3));
    transform: translateX(-50%);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-surface);
  }
  /* Split at wide: the plan and the 3D view in two equal columns with a hairline between (the mockup's divider). */
  .split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1px;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--color-border-default);
  }
</style>
