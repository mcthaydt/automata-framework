<!--
  The 2D editor's Home, phone first: one column on the sage field. The top bar holds "New level", the one primary
  action. Under the title, the game the levels come from ("Your game: Emberwick"), then "Open from" (the levels here,
  or Import files), the search and the cards, and one line on how work is kept. A card opens its level; its More menu
  holds Open, Duplicate, Details and Delete, so there is no side column at any size. New level is a sheet of
  templates; Details and Delete are dialogs.

  This component only wires: the controller decides (`home-controller.ts`), the words come from `home-model.ts`, and
  it knows no profile. Every part stays mounted whatever the size, so a rotation keeps the search, the selection and
  the scroll. (The 3D editor still uses the kit's three-column `HomeScreen` until the 3D slice redesigns it.)
-->
<script lang="ts">
import type { GeometryState } from '@automataframework/automata'
import { onMount, tick } from 'svelte'
import FilePick from '../../shared/kit/home/FilePick.svelte'
import UnavailableNotice from '../../shared/kit/home/UnavailableNotice.svelte'
import EditorShell from '../../shared/kit/shell/EditorShell.svelte'
import { shellModeAt } from '../../shared/kit/shell/shell-mode'
import type { Workspace } from '../../shared/kit/storage/workspace'
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import ToastRegion from '../../shared/kit/widgets/ToastRegion.svelte'
import type { ToastStore } from '../../shared/kit/widgets/toasts'
import type { LevelThumbnails } from '../../shared/level-2d/canvas/level-thumbnails'
import type { ProfileRegistry } from '../../shared/level-2d/profiles/profile'
import type { ProjectEntry } from '../../shared/level-2d/session/editor-app-types'
import DeleteDialog from './DeleteDialog.svelte'
import type { HomeController, HomeState } from './home-controller'
import { cardTitle, homeCard, sourceLabel, storageLine, templateCards } from './home-model'
import LevelList from './LevelList.svelte'
import NewLevelSheet from './NewLevelSheet.svelte'
import type { CardAction } from './ProjectCard.svelte'
import ProjectSummary from './ProjectSummary.svelte'

interface Props {
  geometry: GeometryState
  controller: HomeController
  workspace: Workspace
  registry: ProfileRegistry
  toasts: ToastStore
  /** The time the cards' "Changed …" is told against. */
  clock: { now(): number }
  /** Draws the cards' preview levels; absent, every card shows its initial. */
  thumbnails?: LevelThumbnails | undefined
}

const { geometry, controller, workspace, registry, toasts, clock, thumbnails }: Props = $props()

/** The controller's state right now (its store answers at once), so the first render has the list. */
function snapshot(): HomeState {
  let current: HomeState | undefined
  controller.state.subscribe((value) => (current = value))()
  if (current === undefined) throw new Error('the level list gave no state')
  return current
}

// svelte-ignore state_referenced_locally
let view = $state.raw<HomeState>(snapshot())
$effect(() => controller.state.subscribe((next) => (view = next)))
// Home reads the folder whenever it appears, so coming back from a level shows what that visit changed.
onMount(() => void controller.refresh())

let from = $state<'here' | 'import'>('here')
let creating = $state(false)
let deleting = $state(false)
let details = $state(false)
let list = $state<{ focusSelected(): void }>()

const busy = $derived(view.busy !== undefined)
const menu = $derived(shellModeAt(geometry.current) === 'compact' ? 'sheet' : 'popover')
const selected = $derived(view.visible.find((entry) => entry.path === view.selected))
const cards = $derived(view.visible.map((entry: ProjectEntry) => homeCard(entry, registry, thumbnails)))
const templates = $derived(templateCards(registry))
/**
 * Whether Home offers New level and its templates. The Owner (2026-11-06): templates belong to the try-it page, and
 * the editors keep only what is essential. A game already has its level file (create-game makes it), and a second one
 * would write over the same game files, so on a game folder there is no New level; levels are added inside the file.
 */
const canMakeLevel = $derived(workspace.served !== true)
// "Changed …" is told against the time of the last change to the list, so it is fresh whenever the list is.
const now = $derived.by(() => {
  void view
  return clock.now()
})

function act(path: string, action: CardAction): void {
  controller.select(path)
  if (action === 'open') void controller.open(path)
  else if (action === 'duplicate') void controller.duplicate()
  else if (action === 'details') details = true
  else deleting = true
}

async function confirmDelete(): Promise<void> {
  await controller.remove()
  await tick()
  list?.focusSelected()
}

async function importFiles(files: readonly { name: string; bytes: Uint8Array }[]): Promise<void> {
  await controller.importFiles(files)
  // Back to the list, where the new level now is, selected.
  from = 'here'
}

function onSearchKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && view.query !== '') {
    event.stopPropagation()
    controller.search('')
  }
}
</script>

<EditorShell {geometry} testId="home">
  {#snippet topbar()}
    <span class="brand">Automata</span>
    <span class="spacer"></span>
    {#if canMakeLevel}
      <Button variant="primary" disabled={busy} onclick={() => (creating = true)} data-testid="new-level">
        New level
      </Button>
    {/if}
  {/snippet}

  {#snippet canvas()}
    <div class="scroll" data-scroll-region>
      <div class="column">
        <header>
          <h1>Your levels</h1>
          <!-- In a browser the "Open from" control already says where; a game folder is named here. -->
          {#if workspace.served === true}<p class="source" data-testid="home-source">{sourceLabel(workspace)}</p>{/if}
        </header>

        <Segmented
          label="Open from"
          options={[
            { id: 'here', label: workspace.served === true ? 'This game' : 'This browser' },
            { id: 'import', label: 'Import files' },
          ]}
          bind:value={from}
        />

        {#if from === 'import'}
          <section class="import" aria-label="Import files">
            <p>Bring in level files you made somewhere else. They are added to your levels.</p>
            <FilePick label="Choose files…" multiple {busy} onpick={(files) => void importFiles(files)} />
          </section>
        {:else if view.phase === 'unavailable'}
          <UnavailableNotice
            message={view.message ?? 'Your levels could not be read.'}
            onretry={() => controller.refresh()}
          />
        {:else}
          {#if view.entries.length > 0}
            <input
              type="search"
              aria-label="Search levels"
              data-testid="home-search"
              placeholder="Search levels"
              autocomplete="off"
              spellcheck="false"
              value={view.query}
              oninput={(event) => controller.search(event.currentTarget.value)}
              onkeydown={onSearchKeydown}
            />
          {/if}
          <LevelList
            bind:this={list}
            loading={view.phase === 'loading'}
            total={view.entries.length}
            visible={cards}
            selected={view.selected}
            query={view.query}
            {now}
            {busy}
            {menu}
            onselect={(path) => controller.select(path)}
            onstep={(key) => controller.step(key)}
            onaction={act}
            onnew={canMakeLevel ? () => (creating = true) : undefined}
            onclear={() => controller.search('')}
          />
        {/if}

        <!-- The browser's technical reason for keeping nothing is the tooltip, for whoever asks; the line is hers. -->
        <p class="storage" data-testid="home-storage" title={workspace.reason}>{storageLine(workspace)}</p>
      </div>
    </div>
  {/snippet}

  {#snippet sheets()}
    <NewLevelSheet
      bind:open={creating}
      cards={templates}
      {busy}
      oncreate={(profileId, templateId) => void controller.create(profileId, templateId)}
    />
    <DeleteDialog
      bind:open={deleting}
      name={selected === undefined ? '' : cardTitle(selected)}
      served={workspace.served === true}
      onconfirm={confirmDelete}
    />
    <Dialog bind:open={details} title={selected === undefined ? 'Details' : cardTitle(selected)}>
      {#if selected}<ProjectSummary entry={selected} {now} />{/if}
      {#snippet actions({ close })}
        <Button variant="primary" onclick={close}>Done</Button>
      {/snippet}
    </Dialog>
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
  /* The shell's canvas takes every gesture itself; this region gives the vertical pan back, and nothing else. */
  .scroll {
    box-sizing: border-box;
    height: 100%;
    padding: var(--space-5) var(--space-4);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
    background: var(--bg);
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 44rem;
    margin: 0 auto;
  }
  header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  h1 {
    margin: 0;
    font: var(--text-display-20);
  }
  .source,
  .storage,
  .import p {
    margin: 0;
    color: var(--muted);
    font: var(--text-body-13);
    overflow-wrap: anywhere;
  }
  .import {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-5);
    border: 1px dashed var(--line-strong);
    border-radius: var(--edge-lg);
  }
  input[type='search'] {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: var(--ink);
    font: var(--text-body-13);
  }
  input[type='search']:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
