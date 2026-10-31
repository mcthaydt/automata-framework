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
import { planZoom } from '../../app/plan-picture'
import { checksWords, planStatus } from '../../app/plan-status'
import { planToolCommands } from '../../app/plan-tool-commands'
import { createPlanTools, type PlanToolId } from '../../app/plan-tools'
import type { Point } from '../../format/sector.schema'
import EditorLayers from '../plan/EditorLayers.svelte'
import PlanCanvas from '../plan/PlanCanvas.svelte'
import type { PlanRendererFactory } from '../plan/plan-renderer'
import ToolRail from '../plan/ToolRail.svelte'
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
  /** Runs the checks after the editing pauses. */
  schedule: Scheduler
  onback: () => void
}

const { geometry, controller, toasts, clock, renderer, schedule, onback }: Props = $props()

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
for (const command of planToolCommands(tools)) commands.register(command)
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

let mode = $state(editor.view.state.mode)
let selection = $state.raw<readonly string[]>(editor.selection.ids)
let zoom = $state(planZoom(editor.view.state.camera))
let counts = $state.raw(checks.view)
let pointer = $state.raw<Point | undefined>(undefined)

$effect(() => {
  const stops = [
    editor.view.subscribe((state) => {
      mode = state.mode
      zoom = planZoom(state.camera)
    }),
    editor.selection.subscribe((next) => (selection = next.ids)),
    checks.subscribe(() => (counts = checks.view)),
  ]
  return () => {
    for (const stop of stops) stop()
  }
})

const pill = $derived(checksWords(counts))
const planWords = $derived(planStatus({ pointer, pxPerMetre: zoom, selection, brief: compact }))
// On a phone the bar has no room for the checks pill, so its words lead the status line.
const statusWords = $derived(compact ? `${pill.text} · ${planWords}` : planWords)
</script>

<svelte:window {onkeydown} />

{#snippet toolRail({ orientation }: { orientation: 'vertical' | 'horizontal' })}
  <ToolRail active={activeTool} {orientation} onchoose={(tool) => tools.choose(tool)} />
{/snippet}

<!-- A phone has no tool rail: the plan there is view and select only (ED3D spec §10), and the plan keeps the height. -->
<EditorShell {geometry} bind:panelOpen rail={compact ? undefined : toolRail} testId="document-frame">

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
      views={shellMode === 'wide'}
      checks={pill}
      layersOpen={shellMode === 'wide' ? undefined : panelOpen}
      onlayers={() => (panelOpen = !panelOpen)}
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

  {#snippet status()}
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
    <ToastRegion {toasts} />
  {/snippet}
</EditorShell>
