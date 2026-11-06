<!--
  An open document (it keeps what the older frame did: the top bar, the dialogs and the toasts). The profile's views are the rail; the chosen one fills the shell with its panel,
  canvas and inspector, and this screen hands it what every view shares: the top bar (Back, the title, Undo, Redo, Save),
  the rail, the status line, the Restore and conflict dialogs and the toasts. Switching views remounts the view only;
  the document, its history and its save state stay. A document replaced by Take theirs remounts the view on the new
  one. Everything it does goes through the document controller; nothing here names a profile.
-->
<script lang="ts">
import type { GeometryState } from '@mcthaydt/automata'
import type { Component } from 'svelte'
import { componentOf } from '../../app/editor-2d/views'
import ConflictDialog from '../../shared/kit/dialogs/ConflictDialog.svelte'
import RecoveryDialog from '../../shared/kit/dialogs/RecoveryDialog.svelte'
import { shellModeOf } from '../../shared/kit/shell/shell-mode'
import type { Workspace } from '../../shared/kit/storage/workspace'
import StatusLine from '../../shared/kit/widgets/StatusLine.svelte'
import ToastRegion from '../../shared/kit/widgets/ToastRegion.svelte'
import type { ToastStore } from '../../shared/kit/widgets/toasts'
import type { IdSource } from '../../shared/level-2d/model/ids'
import DocumentBar from './DocumentBar.svelte'
import type { DocumentController, DocumentState } from './document-controller'
import ViewRail from './ViewRail.svelte'
import type { LevelCanvasProps, ObjectUrls, ViewServices, WorldCanvasProps } from './view-props'
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
  /** The world map; the DOM tests pass a stand-in. */
  worldCanvas?: Component<WorldCanvasProps> | undefined
  /** Where the Export view writes; without it the view can only list the files. */
  workspace?: Pick<Workspace, 'store' | 'exports' | 'persistent'> | undefined
  onback: () => void
}

const {
  geometry,
  controller,
  toasts,
  clock,
  read,
  ids,
  objectUrls,
  canvas,
  worldCanvas,
  workspace,
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

/** What the last Undo or Redo did, for a screen reader: the buttons, the keys and the two-finger tap all land here. */
let heard = $state({ text: '', count: 0 })
function undo(): void {
  const label = shown.undoLabel
  controller.undo()
  if (label !== undefined) heard = { text: `Undid ${label}`, count: heard.count + 1 }
}
function redo(): void {
  const label = shown.redoLabel
  controller.redo()
  if (label !== undefined) heard = { text: `Redid ${label}`, count: heard.count + 1 }
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
/** The path Locate asked for, handed to the view it opens; choosing from the rail drops it. */
let focus = $state<string | undefined>(undefined)

const views = $derived(viewsOf(shown.document.profile))
const route = $derived(routeOf(views, chosen))
const View = $derived(componentOf(route?.component ?? ''))

const services = $derived<ViewServices>({
  read: (path) => read(path),
  ids,
  objectUrls,
  canvas,
  worldCanvas,
  onundo: undo,
  onredo: redo,
  locate: (path) => {
    focus = path
    chosen = views[0]?.id
    fromRail = false
  },
  workspace,
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
    onundo={undo}
    onredo={redo}
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
      focus = undefined
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
  {#key heard.count}
    <p class="heard" aria-live="polite" data-testid="history-announcement">{heard.text}</p>
  {/key}
{/snippet}

{#key shown.document}
  {#key route?.id}
    <View
      {geometry}
      document={shown.document}
      label={route?.label ?? shown.document.profile.label}
      frame={{ topbar, rail, status, sheets }}
      {services}
      {focus}
    />
  {/key}
{/key}

<style>
  .heard {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
