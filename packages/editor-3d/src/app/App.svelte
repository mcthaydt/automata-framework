<!--
  The root of the 3D editor (plan ED3D.5c): Home, or the level that was opened from it. It owns the route and the Home
  controller, so the search, the selection and the list survive a visit to a level. A file that does not open gets the
  error panel over Home. A level that is left (Back, or the editor closing) is closed by its controller, which writes
  its journal first; opening waits for that, so a reopened file finds its autosave.
-->
<script lang="ts">
import type { LifecycleDocument, LifecycleWindow, ToastStore, Workspace } from '@automata/editor/kit/core'
import type { GeometryState } from '@automata/framework'
import { onDestroy } from 'svelte'
import type { Scheduler } from '../features/levels-3d/checks/checks-panel-controller'
import DocumentFrame from '../features/levels-3d/document/DocumentFrame.svelte'
import {
  createDocumentController,
  type DocumentController,
} from '../features/levels-3d/document/document-controller'
import ErrorPanel from '../features/levels-3d/document/ErrorPanel.svelte'
import type { EditorApp } from '../features/levels-3d/document/editor-app'
import type { PanelOutcome } from '../features/levels-3d/document/open-flow-model'
import Home from '../features/levels-3d/home/Home.svelte'
import { createHomeController } from '../features/levels-3d/home/home-controller'
import type { PlanRendererFactory } from '../features/levels-3d/plan/plan-renderer'
import type { Frames } from '../features/levels-3d/walk/frames'

interface Props {
  geometry: GeometryState
  app: EditorApp
  workspace: Workspace
  toasts: ToastStore
  clock: { now(): number }
  /** The page whose hiding writes an open level's journal. */
  lifecycle: { readonly document: LifecycleDocument; readonly window: LifecycleWindow }
  /** The Plan view's renderer and the checks' scheduler, for an opened level. */
  renderer: PlanRendererFactory
  schedule: Scheduler
  /** The Walk view's frame clock. */
  frames?: Frames | undefined
}

const { geometry, app, workspace, toasts, clock, lifecycle, renderer, schedule, frames }: Props = $props()

let open = $state.raw<DocumentController | undefined>(undefined)
let failure = $state.raw<PanelOutcome | undefined>(undefined)

/** The closes still running (one promise for all: a close is short). Opening and the editor's dispose wait for them. */
let closing: Promise<void> = Promise.resolve()

function close(document: DocumentController): void {
  closing = Promise.all([closing, document.close()]).then(() => undefined)
}

/** Settles when every level that was left has finished closing. */
export function idle(): Promise<void> {
  return closing
}

// svelte-ignore state_referenced_locally
const opening: EditorApp = {
  ...app,
  open: async (path) => {
    await closing
    return app.open(path)
  },
}

// svelte-ignore state_referenced_locally
const controller = createHomeController({
  app: opening,
  toasts,
  onOpened: (opened) => {
    open = createDocumentController({ app, opened, toasts, lifecycle })
  },
  onProblem: (outcome) => {
    failure = outcome
  },
})

function back(): void {
  if (open !== undefined) close(open)
  open = undefined
}

onDestroy(() => {
  if (open !== undefined) close(open)
})
</script>

{#if open}
  <DocumentFrame {geometry} controller={open} {toasts} {clock} {renderer} {schedule} {frames} onback={back} />
{:else}
  <Home {geometry} {controller} {workspace} installed={app.installed} {toasts} {clock} />
  <ErrorPanel
    outcome={failure}
    copyText={(text) => workspace.exports.copyText(text)}
    {toasts}
    onclose={() => (failure = undefined)}
  />
{/if}
