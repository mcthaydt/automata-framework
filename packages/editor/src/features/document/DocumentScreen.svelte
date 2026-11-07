<!--
  An open document. The profile's views (Level, Map, Tiles, Characters) are chosen from the switcher in the top bar;
  the chosen one fills its kit shell with its canvas, panel and inspector, and this screen hands it what every view
  shares: the top bar (Back, the name, the switcher, Problems, Share where Save does not write the game, Undo, Redo,
  Save), the Restore, conflict and leave dialogs and the toasts. There is no rail and no status bar: Save says where
  the level stands and Problems counts what is wrong. Back with unsaved changes asks first. Switching views remounts
  the view only; the document, its history and its save state stay. A document replaced by Take theirs remounts the
  view on the new one. Everything it does goes through the document controller; nothing here names a profile.
-->
<script lang="ts">
import type { GeometryState } from '@mcthaydt/automata'
import type { Component, Snippet } from 'svelte'
import { componentOf } from '../../app/editor-2d/views'
import ConflictDialog from '../../shared/kit/dialogs/ConflictDialog.svelte'
import type { GestureClock } from '../../shared/kit/gestures/gesture-clock'
import RecoveryDialog from '../../shared/kit/dialogs/RecoveryDialog.svelte'
import { shellModeAt } from '../../shared/kit/shell/shell-mode'
import type { ProjectStore } from '../../shared/kit/storage/project-store'
import type { Workspace } from '../../shared/kit/storage/workspace'
import ToastRegion from '../../shared/kit/widgets/ToastRegion.svelte'
import type { ToastStore } from '../../shared/kit/widgets/toasts'
import type { IdSource } from '../../shared/level-2d/model/ids'
import Problems from '../problems/Problems.svelte'
import ShareMenu from '../share/ShareMenu.svelte'
import DocumentBar from './DocumentBar.svelte'
import type { DocumentController, DocumentState } from './document-controller'
import LeaveDialog from './LeaveDialog.svelte'
import RenameDialog from './RenameDialog.svelte'
import ViewSwitcher from './ViewSwitcher.svelte'
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
  /** Where a view adds a file of the person's (Add tiles' picture); without it, nothing that writes one is shown. */
  files?: Pick<ProjectStore, 'list' | 'write'> | undefined
  ids: IdSource
  objectUrls?: ObjectUrls | undefined
  /** The level canvas; the DOM tests pass a stand-in. */
  canvas?: Component<LevelCanvasProps> | undefined
  /** The world map; the DOM tests pass a stand-in. */
  worldCanvas?: Component<WorldCanvasProps> | undefined
  /** The gestures' time; the browser's when absent. Journeys pass their test clock. */
  gestureClock?: GestureClock | undefined
  /** Where the Share menu sends the level; without it there is no Share menu. */
  workspace?: Pick<Workspace, 'exports' | 'persistent'> | undefined
  onback: () => void
}

const {
  geometry,
  controller,
  toasts,
  clock,
  read,
  files,
  ids,
  objectUrls,
  canvas,
  worldCanvas,
  gestureClock,
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

/** Back with changes not yet saved asks first (`LeaveDialog`); with none it leaves at once. */
let leaving = $state(false)
function back(): void {
  if (shown.save === 'dirty' || shown.save === 'error') leaving = true
  else onback()
}
async function saveAndLeave(): Promise<void> {
  await controller.save()
  // A save that conflicted or failed has its own dialog or toast: stay, so she sees it.
  if (shown.save === 'saved') onback()
}
async function leaveWithoutSaving(): Promise<void> {
  await controller.closeWithoutSaving()
  onback()
}

// svelte-ignore state_referenced_locally
let shown = $state.raw<DocumentState>(snapshot(controller))
$effect(() => controller.state.subscribe((next) => (shown = next)))

let chosen = $state<string | undefined>(undefined)
/** The heading takes focus when the document opens, not each time a view is chosen (the switcher keeps it). */
let arrived = $state(false)
/** A view was chosen from the switcher, so the switcher of the view it opens takes the focus. */
let fromSwitcher = $state(false)
/** The path Problems' Show asked for, handed to the view it opens; choosing from the switcher drops it. */
let focus = $state<string | undefined>(undefined)
/** The compact layout (a phone, or a window 760 px across and narrower): the switcher is a menu. */
const compact = $derived(shellModeAt(geometry.current) === 'compact')
/**
 * A phone or an iPad held upright: the top bar takes two rows, so the name and the Level view's level picker keep
 * their words beside Back and Save (one row at 744 px cut the picker to its first letter).
 */
const twoRows = $derived(compact || geometry.current.formFactor === 'tablet-portrait')
/** Share only where Save does not already write the game. */
const shares = $derived(workspace !== undefined && shown.document.gameFolder === undefined)

const views = $derived(viewsOf(shown.document.profile))
const route = $derived(routeOf(views, chosen))
const View = $derived(componentOf(route?.component ?? ''))

const services = $derived<ViewServices>({
  read: (path) => read(path),
  files,
  ids,
  objectUrls,
  canvas,
  worldCanvas,
  gestureClock,
  onundo: undo,
  onredo: redo,
})

/** The rename dialog, opened by tapping the name; the rename is one undo step. */
let renaming = $state(false)
function rename(name: string): void {
  const { profile, history } = shown.document
  const renamed = profile.rename
  if (renamed !== undefined) history.apply('Rename', (value) => renamed(value, name))
}

/** Counts Problems' Shows, so a Show while the Level view is already open still reopens it on the finding. */
let shows = $state(0)
/** Problems' Show: the first view (Level) opens on what the finding names. */
function show(path: string): void {
  focus = path
  chosen = views[0]?.id
  fromSwitcher = false
  shows += 1
}
</script>

{#snippet switcher()}
  <ViewSwitcher
    {views}
    current={route?.id}
    {compact}
    focusCurrent={fromSwitcher}
    onselect={(id) => {
      chosen = id
      fromSwitcher = true
      focus = undefined
    }}
  />
{/snippet}

{#snippet tools()}
  <Problems document={shown.document} onshow={show} />
  {#if shares && workspace !== undefined}
    <ShareMenu document={shown.document} exports={workspace.exports} persistent={workspace.persistent} {toasts} />
  {/if}
{/snippet}

{#snippet topbar(place?: Snippet)}
  <DocumentBar
    heading={shown.heading}
    save={shown.save}
    canUndo={shown.canUndo}
    canRedo={shown.canRedo}
    undoLabel={shown.undoLabel}
    redoLabel={shown.redoLabel}
    busy={shown.busy !== undefined}
    compact={twoRows}
    onrename={shown.document.profile.rename === undefined ? undefined : () => (renaming = true)}
    {switcher}
    {place}
    {tools}
    autofocus={!arrived}
    onfocused={() => (arrived = true)}
    onback={back}
    onundo={undo}
    onredo={redo}
    onsave={() => controller.save()}
  />
{/snippet}

{#snippet sheets()}
  <RecoveryDialog
    name={shown.heading.title}
    recovery={shown.recovery}
    now={clock.now()}
    busy={shown.busy !== undefined}
    onrestore={() => controller.restore()}
    ondiscard={() => controller.discard()}
  />
  <ConflictDialog
    open={shown.conflict}
    name={shown.heading.title}
    busy={shown.busy !== undefined}
    onkeep={() => controller.keepMine()}
    ontake={() => controller.takeTheirs()}
    oncopy={() => controller.saveCopy()}
    oncancel={() => controller.dismissConflict()}
  />
  <LeaveDialog
    bind:open={leaving}
    name={shown.heading.title}
    onsave={() => void saveAndLeave()}
    ondiscard={() => void leaveWithoutSaving()}
  />
  <RenameDialog bind:open={renaming} name={shown.heading.title} onrename={rename} />
  <ToastRegion {toasts} />
  {#key heard.count}
    <p class="heard" aria-live="polite" data-testid="history-announcement">{heard.text}</p>
  {/key}
{/snippet}

{#key shown.document}
  {#key `${route?.id}:${shows}`}
    <View
      {geometry}
      document={shown.document}
      label={route?.label ?? shown.document.profile.label}
      frame={{ topbar, sheets }}
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
