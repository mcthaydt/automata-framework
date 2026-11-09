<!--
  The root of the 3D editor (plan ED3D.5c): Home, or the level that was opened from it. It owns the route and the Home
  controller, so the search, the selection and the list survive a visit to a level. A file that does not open gets the
  error panel over Home. A level that is left (Back, or the editor closing) is closed by its controller, which writes
  its journal first; opening waits for that, so a reopened file finds its autosave.
-->
<script lang="ts">
import type { GeometryState } from '@automataframework/automata'
import type {
  LifecycleDocument,
  LifecycleWindow,
  ToastStore,
  Workspace,
} from '@automataframework/automata-editor/kit/core'
import { onDestroy } from 'svelte'
import type { Scheduler } from '../app/checks-panel-controller'
import { createDocumentController, type DocumentController } from '../app/document/document-controller'
import type { PanelOutcome } from '../app/document/open-flow-model'
import type { EditorApp } from '../app/editor-app'
import { createHomeController } from '../app/home/home-controller'
import DocumentFrame from './document/DocumentFrame.svelte'
import ErrorPanel from './document/ErrorPanel.svelte'
import Home from './home/Home.svelte'
import type { PlanRendererFactory } from './plan/plan-renderer'
import type { Frames } from './walk/frames'

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
