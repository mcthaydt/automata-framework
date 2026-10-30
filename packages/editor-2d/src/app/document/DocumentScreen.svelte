<!--
  An open document (plan ED2D.4c4a decision 1; plans ED2D.4c2a decision 10 and ED2D.4c2b decisions 5 to 8 for what it
  kept from the frame it replaces). The profile's views are the rail; the chosen one fills the shell with its panel,
  canvas and inspector, and this screen hands it what every view shares: the top bar (Back, the title, Undo, Redo, Save),
  the rail, the status line, the Restore and conflict dialogs and the toasts. Switching views remounts the view only;
  the document, its history and its save state stay. A document replaced by Take theirs remounts the view on the new
  one. Everything it does goes through the document controller; nothing here names a profile.
-->
<script lang="ts">
import {
  ConflictDialog,
  RecoveryDialog,
  StatusLine,
  shellModeOf,
  ToastRegion,
} from '@mcthaydt/automata-editor-kit'
import type { ToastStore } from '@mcthaydt/automata-editor-kit/core'
import type { GeometryState } from '@mcthaydt/automata-ui'
import type { Component } from 'svelte'
import type { IdSource } from '../../model/ids'
import type { LevelCanvasProps, ObjectUrls, ViewServices } from '../views/view-props'
import { componentOf } from '../views/views'
import DocumentBar from './DocumentBar.svelte'
import type { DocumentController, DocumentState } from './document-controller'
import ViewRail from './ViewRail.svelte'
import { routeOf, viewsOf } from './view-router'

interface Props {
  geometry: GeometryState
  controller: DocumentController
  toasts: ToastStore
  /** The time an autosave's age is told against. */
  clock: { now(): number }
  /** Reads a workspace file's bytes, for the canvas and the palette. */
  read: (path: string) => Promise<Uint8Array | undefined>
  ids: IdSource
  objectUrls?: ObjectUrls | undefined
  /** The level canvas; the DOM tests pass a stand-in. */
  canvas?: Component<LevelCanvasProps> | undefined
  onback: () => void
}

const { geometry, controller, toasts, clock, read, ids, objectUrls, canvas, onback }: Props = $props()

/** The controller's state right now (its store answers at once). */
function snapshot(source: DocumentController): DocumentState {
  let current: DocumentState | undefined
  source.state.subscribe((value) => {
    current = value
  })()
  if (current === undefined) throw new Error('the document controller gave no state')
  return current
}

const compact = $derived(shellModeOf(geometry.current.formFactor) === 'compact')

// svelte-ignore state_referenced_locally
let shown = $state.raw<DocumentState>(snapshot(controller))
$effect(() => controller.state.subscribe((next) => (shown = next)))

let chosen = $state<string | undefined>(undefined)
/** The heading takes focus when the document opens, not each time a view is chosen (the rail keeps it). */
let arrived = $state(false)
/** A view was chosen from the rail, so the rail of the view it opens takes the focus. */
let fromRail = $state(false)

const views = $derived(viewsOf(shown.document.profile))
const route = $derived(routeOf(views, chosen))
const View = $derived(componentOf(route?.component ?? ''))

const services = $derived<ViewServices>({
  read: (path) => read(path),
  ids,
  objectUrls,
  canvas,
  onundo: () => controller.undo(),
  onredo: () => controller.redo(),
})
</script>

{#snippet topbar()}
  <DocumentBar
    heading={shown.heading}
    profileLabel={shown.document.profile.label}
    canUndo={shown.canUndo}
    canRedo={shown.canRedo}
    undoLabel={shown.undoLabel}
    redoLabel={shown.redoLabel}
    busy={shown.busy !== undefined}
    {compact}
    autofocus={!arrived}
    onfocused={() => (arrived = true)}
    {onback}
    onundo={() => controller.undo()}
    onredo={() => controller.redo()}
    onsave={() => controller.save()}
  />
{/snippet}

{#snippet rail({ orientation }: { orientation: 'vertical' | 'horizontal' })}
  <ViewRail
    {views}
    current={route?.id}
    {orientation}
    focusCurrent={fromRail}
    onselect={(id) => {
      chosen = id
      fromRail = true
    }}
  />
{/snippet}

{#snippet status()}
  <StatusLine save={shown.save} />
{/snippet}

{#snippet sheets()}
  <RecoveryDialog
    path={shown.document.path}
    recovery={shown.recovery}
    now={clock.now()}
    busy={shown.busy !== undefined}
    onrestore={() => controller.restore()}
    ondiscard={() => controller.discard()}
  />
  <ConflictDialog
    open={shown.conflict}
    path={shown.document.path}
    busy={shown.busy !== undefined}
    onkeep={() => controller.keepMine()}
    ontake={() => controller.takeTheirs()}
    oncopy={() => controller.saveCopy()}
    oncancel={() => controller.dismissConflict()}
  />
  <ToastRegion {toasts} />
{/snippet}

{#key shown.document}
  {#key route?.id}
    <View
      {geometry}
      document={shown.document}
      label={route?.label ?? shown.document.profile.label}
      frame={{ topbar, rail, status, sheets }}
      {services}
    />
  {/key}
{/key}
