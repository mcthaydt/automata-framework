<!--
  Home (plan ED2D.4c2a; 2D editor spec §8): where a session starts. It is the kit's shell with no rail: the sources
  panel on the left, the projects with a search and the templates in one scroll region of their own, and the selected
  project on the right. Below `wide` the panel and the inspector are drawers (medium) or sheets (compact); two buttons
  in the top bar open them, and choosing a project opens its inspector, since its actions live there. Every region
  stays mounted whatever the size, so a rotation keeps the selection, the search text and the scroll position.

  This component only wires: the controller decides (see `home-controller.ts` and `home-model.ts`), the parts below
  draw. It knows no profile; the templates, kinds and summaries all come from the registry.
-->
<script lang="ts">
import { EditorShell, StatusLine, shellModeOf, ToastRegion } from '@mcthaydt/automata-editor-kit'
import type { ToastStore, Workspace } from '@mcthaydt/automata-editor-kit/core'
import type { GeometryState } from '@mcthaydt/automata-ui'
import { onMount, tick } from 'svelte'
import type { ProfileRegistry } from '../../profiles/profile'
import Button from '../controls/Button.svelte'
import DeleteDialog from './DeleteDialog.svelte'
import type { HomeController, HomeState } from './home-controller'
import { projectCount, splitPath, templateCards } from './home-model'
import ProjectList from './ProjectList.svelte'
import ProjectSummary from './ProjectSummary.svelte'
import SourcesPanel from './SourcesPanel.svelte'
import TemplateRow from './TemplateRow.svelte'
import UnavailableNotice from './UnavailableNotice.svelte'

interface Props {
  geometry: GeometryState
  controller: HomeController
  workspace: Workspace
  registry: ProfileRegistry
  toasts: ToastStore
  /** The time the ages on the cards are told against. */
  clock: { now(): number }
}

const { geometry, controller, workspace, registry, toasts, clock }: Props = $props()

/** The controller's state right now (its store answers at once). */
function snapshot(source: HomeController): HomeState {
  let current: HomeState | undefined
  source.state.subscribe((value) => {
    current = value
  })()
  if (current === undefined) throw new Error('the home controller gave no state')
  return current
}

// svelte-ignore state_referenced_locally
let view = $state.raw<HomeState>(snapshot(controller))
$effect(() => controller.state.subscribe((next) => (view = next)))

// Home reads the workspace whenever it appears, so coming back from a document shows what that document did.
onMount(() => {
  void controller.refresh()
})

let panelOpen = $state(false)
let inspectorOpen = $state(false)
let deleteOpen = $state(false)
let scroller = $state<HTMLElement>()

const mode = $derived(shellModeOf(geometry.current.formFactor))
const selectedEntry = $derived(view.visible.find((entry) => entry.path === view.selected))
const busy = $derived(view.busy !== undefined)
// Ages are told against the time of the last change to the list, so they are fresh whenever the list is.
const now = $derived.by(() => {
  void view
  return clock.now()
})
const cards = $derived(templateCards(registry))

function select(path: string): void {
  controller.select(path)
  if (mode !== 'wide') inspectorOpen = true
}

async function confirmDelete(): Promise<void> {
  await controller.remove()
  await tick()
  scroller?.querySelector<HTMLElement>('[role="listbox"]')?.focus()
}

function onSearchKeydown(event: KeyboardEvent): void {
  // Escape clears the text first; the drawers only hear it when there is nothing to clear.
  if (event.key === 'Escape' && view.query !== '') {
    event.stopPropagation()
    controller.search('')
  }
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  panelOpen = false
  inspectorOpen = false
}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<EditorShell {geometry} bind:panelOpen bind:inspectorOpen testId="home">
  {#snippet topbar()}
    <span class="brand">Automata</span>
    <span class="spacer"></span>
    {#if mode !== 'wide'}
      <Button aria-expanded={panelOpen} onclick={() => (panelOpen = !panelOpen)} data-testid="toggle-sources">
        Sources
      </Button>
      <Button
        aria-expanded={inspectorOpen}
        onclick={() => (inspectorOpen = !inspectorOpen)}
        data-testid="toggle-details"
      >
        Details
      </Button>
    {/if}
  {/snippet}

  {#snippet panel()}
    <SourcesPanel {workspace} count={view.entries.length} {busy} onimport={(files) => controller.importFiles(files)} />
  {/snippet}

  {#snippet canvas()}
    <div class="scroll" data-scroll-region bind:this={scroller}>
      <header>
        <div class="titles">
          <h1>Projects</h1>
          <span class="count">{projectCount(view.entries.length, view.visible.length, view.query)}</span>
        </div>
        <input
          type="search"
          aria-label="Search projects"
          data-testid="home-search"
          placeholder="Search projects"
          autocomplete="off"
          spellcheck="false"
          value={view.query}
          oninput={(event) => controller.search(event.currentTarget.value)}
          onkeydown={onSearchKeydown}
        />
      </header>

      {#if view.phase === 'unavailable'}
        <UnavailableNotice
          message={view.message ?? 'The workspace could not be read.'}
          onretry={() => controller.refresh()}
        />
      {:else}
        <ProjectList
          loading={view.phase === 'loading'}
          total={view.entries.length}
          visible={view.visible}
          selected={view.selected}
          query={view.query}
          {registry}
          {now}
          onselect={select}
          onstep={(key) => controller.step(key)}
          onopen={(path) => controller.open(path)}
          ondelete={() => (deleteOpen = true)}
          onclear={() => controller.search('')}
        />
      {/if}

      <TemplateRow {cards} {busy} oncreate={(profileId, templateId) => controller.create(profileId, templateId)} />
    </div>
  {/snippet}

  {#snippet inspector()}
    <ProjectSummary
      entry={selectedEntry}
      {busy}
      {now}
      onopen={() => controller.open()}
      onduplicate={() => controller.duplicate()}
      ondelete={() => (deleteOpen = true)}
    />
  {/snippet}

  {#snippet status()}
    <StatusLine save={workspace.persistent ? 'saved' : 'device'} />
  {/snippet}

  {#snippet sheets()}
    <DeleteDialog
      bind:open={deleteOpen}
      name={selectedEntry === undefined ? '' : splitPath(selectedEntry.path).name}
      onconfirm={confirmDelete}
    />
    <ToastRegion {toasts} />
  {/snippet}
</EditorShell>

<style>
  .brand {
    font: var(--text-title-15);
  }
  .spacer {
    flex: 1;
  }
  /* The canvas of the shell takes every gesture itself; this region gives the vertical pan back, and nothing else. */
  .scroll {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    height: 100%;
    padding: var(--space-5);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
    background: var(--color-bg-app);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .titles {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
  }
  h1 {
    margin: 0;
    font: var(--text-display-20);
  }
  .count {
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  input[type='search'] {
    box-sizing: border-box;
    flex: 1 1 12rem;
    max-width: 20rem;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  input[type='search']:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
</style>
