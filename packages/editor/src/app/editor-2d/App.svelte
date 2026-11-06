<!--
  The root of the editor (plans ED2D.4c2a decision 9, ED2D.4c2b decisions 1 and 9): Home, or the document that was
  opened from it. It owns the route and the Home controller, so the search, the selection and the list survive a visit
  to a document. A file that does not open gets the error panel over Home, and a file two profiles claim gets the
  profile choice. A document that is left (Back, or the editor closing) is closed by its controller, which writes its
  journal first. Nothing here names a profile.
-->
<script lang="ts">
import type { GeometryState } from '@mcthaydt/automata'
import { type Component, onDestroy } from 'svelte'
import DocumentScreen from '../../features/document/DocumentScreen.svelte'
import {
  createDocumentController,
  type DocumentController,
} from '../../features/document/document-controller'
import ErrorPanel from '../../features/document/ErrorPanel.svelte'
import type { ChoiceOutcome, PanelOutcome } from '../../features/document/open-flow-model'
import ProfileChoice from '../../features/document/ProfileChoice.svelte'
import type { LevelCanvasProps, ObjectUrls } from '../../features/document/view-props'
import Home from '../../features/home/Home.svelte'
import { createHomeController, type LastOpened } from '../../features/home/home-controller'
import type { LifecycleDocument, LifecycleWindow } from '../../shared/kit/storage/page-lifecycle'
import type { Workspace } from '../../shared/kit/storage/workspace'
import type { ToastStore } from '../../shared/kit/widgets/toasts'
import type { LevelThumbnails } from '../../shared/level-2d/canvas/level-thumbnails'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type { ProfileRegistry } from '../../shared/level-2d/profiles/profile'
import type { EditorApp } from './editor-app'

interface Props {
  geometry: GeometryState
  app: EditorApp
  workspace: Workspace
  registry: ProfileRegistry
  toasts: ToastStore
  clock: { now(): number }
  /** The page whose hiding writes an open document's journal. */
  lifecycle: { readonly document: LifecycleDocument; readonly window: LifecycleWindow }
  /** Draws the Home cards' preview levels (ED2D.4c3b). */
  thumbnails?: LevelThumbnails | undefined
  /** Where the ids of instances placed in the Level view come from (the app's own). */
  ids: IdSource
  /** Object URLs for the palette's tile pictures; absent, the palette shows numbered tiles. */
  objectUrls?: ObjectUrls | undefined
  /** The level canvas; the DOM tests pass a stand-in (jsdom has no WebGL). */
  canvas?: Component<LevelCanvasProps> | undefined
  /** The project opened last time, which Home selects again. */
  lastOpened?: LastOpened | undefined
}

const {
  geometry,
  app,
  workspace,
  registry,
  toasts,
  clock,
  lifecycle,
  thumbnails,
  ids,
  objectUrls,
  canvas,
  lastOpened,
}: Props = $props()

let open = $state.raw<DocumentController | undefined>(undefined)
let failure = $state.raw<PanelOutcome | undefined>(undefined)
let choice = $state.raw<ChoiceOutcome | undefined>(undefined)

/**
 * The closes still running: a document left on Back writes its journal before it is disposed. Opening waits for them,
 * so reopening the file at once finds that journal (`findRecovery`), and the editor's own dispose waits for them too.
 * One promise for every close, not one per file: a close is short, and waiting for an unrelated one costs little.
 */
let closing: Promise<void> = Promise.resolve()

function close(document: DocumentController): void {
  closing = Promise.all([closing, document.close()]).then(() => undefined)
}

/** Settles when every document that was left has finished closing. */
export function idle(): Promise<void> {
  return closing
}

// svelte-ignore state_referenced_locally
const opening: EditorApp = {
  ...app,
  open: async (path, as) => {
    await closing
    return app.open(path, as)
  },
}

// svelte-ignore state_referenced_locally
const controller = createHomeController({
  app: opening,
  toasts,
  ...(lastOpened === undefined ? {} : { lastOpened }),
  onOpened: (opened) => {
    open = createDocumentController({ app, opened, toasts, lifecycle })
  },
  onProblem: (outcome) => {
    if (outcome.status === 'choose') choice = outcome
    else failure = outcome
  },
})

function back(): void {
  if (open !== undefined) close(open)
  open = undefined
}

function choose(profileId: string): void {
  const path = choice?.path
  choice = undefined
  if (path !== undefined) void controller.open(path, profileId)
}

onDestroy(() => {
  if (open !== undefined) close(open)
})
</script>

{#if open}
  <DocumentScreen
    {geometry}
    controller={open}
    {toasts}
    {clock}
    read={(path) => workspace.store.read(path)}
    {ids}
    {objectUrls}
    {canvas}
    {workspace}
    onback={back}
  />
{:else}
  <Home {geometry} {controller} {workspace} {registry} {toasts} {clock} {thumbnails} />
  <ErrorPanel
    outcome={failure}
    copyText={(text) => workspace.exports.copyText(text)}
    {toasts}
    onclose={() => (failure = undefined)}
  />
  <ProfileChoice outcome={choice} onchoose={choose} oncancel={() => (choice = undefined)} />
{/if}
