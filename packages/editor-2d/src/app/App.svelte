<!--
  The root of the editor (plans ED2D.4c2a decision 9, ED2D.4c2b decisions 1 and 9): Home, or the document that was
  opened from it. It owns the route and the Home controller, so the search, the selection and the list survive a visit
  to a document. A file that does not open gets the error panel over Home, and a file two profiles claim gets the
  profile choice. A document that is left (Back, or the editor closing) is closed by its controller, which writes its
  journal first. Nothing here names a profile.
-->
<script lang="ts">
import type {
  LifecycleDocument,
  LifecycleWindow,
  ToastStore,
  Workspace,
} from '@mcthaydt/automata-editor-kit/core'
import type { GeometryState } from '@mcthaydt/automata-ui'
import { onDestroy } from 'svelte'
import type { ProfileRegistry } from '../profiles/profile'
import DocumentFrame from './DocumentFrame.svelte'
import { createDocumentController, type DocumentController } from './document/document-controller'
import ErrorPanel from './document/ErrorPanel.svelte'
import type { ChoiceOutcome, PanelOutcome } from './document/open-flow-model'
import ProfileChoice from './document/ProfileChoice.svelte'
import type { EditorApp } from './editor-app'
import Home from './home/Home.svelte'
import { createHomeController } from './home/home-controller'

interface Props {
  geometry: GeometryState
  app: EditorApp
  workspace: Workspace
  registry: ProfileRegistry
  toasts: ToastStore
  clock: { now(): number }
  /** The page whose hiding writes an open document's journal. */
  lifecycle: { readonly document: LifecycleDocument; readonly window: LifecycleWindow }
}

const { geometry, app, workspace, registry, toasts, clock, lifecycle }: Props = $props()

let open = $state.raw<DocumentController | undefined>(undefined)
let failure = $state.raw<PanelOutcome | undefined>(undefined)
let choice = $state.raw<ChoiceOutcome | undefined>(undefined)

// svelte-ignore state_referenced_locally
const controller = createHomeController({
  app,
  toasts,
  onOpened: (opened) => {
    open = createDocumentController({ app, opened, toasts, lifecycle })
  },
  onProblem: (outcome) => {
    if (outcome.status === 'choose') choice = outcome
    else failure = outcome
  },
})

function back(): void {
  void open?.close()
  open = undefined
}

function choose(profileId: string): void {
  const path = choice?.path
  choice = undefined
  if (path !== undefined) void controller.open(path, profileId)
}

onDestroy(() => void open?.close())
</script>

{#if open}
  <DocumentFrame {geometry} controller={open} {toasts} {clock} onback={back} />
{:else}
  <Home {geometry} {controller} {workspace} {registry} {toasts} {clock} />
  <ErrorPanel
    outcome={failure}
    copyText={(text) => workspace.exports.copyText(text)}
    {toasts}
    onclose={() => (failure = undefined)}
  />
  <ProfileChoice outcome={choice} onchoose={choose} oncancel={() => (choice = undefined)} />
{/if}
