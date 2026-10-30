<!--
  The root of the editor (plan ED2D.4c2a, decision 9): Home, or the document that was opened from it. It owns the route
  and the Home controller, so the search, the selection and the list survive a visit to a document. A document that is
  left (Back, or the editor closing) is disposed, so its autosave stops. Nothing here names a profile.
-->
<script lang="ts">
import type { ToastStore, Workspace } from '@mcthaydt/automata-editor-kit/core'
import type { GeometryState } from '@mcthaydt/automata-ui'
import { onDestroy } from 'svelte'
import type { LevelThumbnails } from '../canvas/level-thumbnails'
import type { ProfileRegistry } from '../profiles/profile'
import DocumentFrame from './DocumentFrame.svelte'
import type { EditorApp, OpenOutcome } from './editor-app'
import Home from './home/Home.svelte'
import { createHomeController } from './home/home-controller'

interface Props {
  geometry: GeometryState
  app: EditorApp
  workspace: Workspace
  registry: ProfileRegistry
  toasts: ToastStore
  clock: { now(): number }
  thumbnails?: LevelThumbnails | undefined
}

const { geometry, app, workspace, registry, toasts, clock, thumbnails }: Props = $props()

type Opened = Extract<OpenOutcome, { status: 'opened' }>
let open = $state.raw<Opened | undefined>(undefined)

// svelte-ignore state_referenced_locally
const controller = createHomeController({
  app,
  toasts,
  onOpened: (opened) => {
    open = opened
  },
})

function back(): void {
  open?.document.dispose()
  open = undefined
}

onDestroy(() => open?.document.dispose())
</script>

{#if open}
  <DocumentFrame {geometry} opened={open} {toasts} onback={back} />
{:else}
  <Home {geometry} {controller} {workspace} {registry} {toasts} {clock} {thumbnails} />
{/if}
