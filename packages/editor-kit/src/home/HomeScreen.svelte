<!--
  Home (plan ED2D.4c2a; moved into the kit in ED3D.5c so both editors share it): where a session starts. It is the
  kit's shell with no rail: the sources panel on the left, the projects with a search (and whatever the editor puts
  below them, such as templates) in one scroll region of their own, and the selected project on the right. Below `wide`
  the panel and the inspector are drawers (medium) or sheets (compact); two buttons in the top bar open them, and
  choosing a project opens its inspector, since its actions live there. Every region stays mounted whatever the size,
  so a rotation keeps the selection, the search text and the scroll position.

  It only wires: the editor's controller decides (a `ProjectListSource`), `card` says how an entry reads, and the
  editor's snippets draw its import controls, the inspector and its dialogs. It knows no file format.
-->
<script lang="ts" generics="E extends { readonly path: string }, B extends string">
import type { GeometryState } from '@mcthaydt/automata-ui'
import { onMount, type Snippet } from 'svelte'
import EditorShell from '../shell/EditorShell.svelte'
import { shellModeOf } from '../shell/shell-mode'
import type { Workspace } from '../storage/workspace'
import Button from '../widgets/Button.svelte'
import StatusLine from '../widgets/StatusLine.svelte'
import ToastRegion from '../widgets/ToastRegion.svelte'
import type { ToastStore } from '../widgets/toasts'
import ProjectList from './ProjectList.svelte'
import { type HomeCard, projectCount } from './project-browse'
import type { BrowserState, ProjectListSource } from './project-browser'
import SourcesPanel from './SourcesPanel.svelte'
import UnavailableNotice from './UnavailableNotice.svelte'

// The snippets are renamed here: the shell's own `inspector` and `sheets` snippets below would hide them. The props
// are typed inline: a generic component's declaration may not name a private `Props`.
const {
  geometry,
  source,
  card,
  workspace,
  toasts,
  clock,
  emptyHint,
  onopen,
  ondelete,
  importers: importersOf,
  inspector: inspectorOf,
  below,
  sheets: sheetsOf,
}: {
  geometry: GeometryState
  source: ProjectListSource<E, B>
  /** How an entry reads on its card. */
  card: (entry: E) => HomeCard
  workspace: Workspace
  toasts: ToastStore
  /** The time the ages on the cards are told against. */
  clock: { now(): number }
  /** How to start a project, shown when the workspace holds none. */
  emptyHint: string
  onopen: (path: string) => void
  /** Delete on the list asks this; without it, Delete does nothing. */
  ondelete?: (() => void) | undefined
  /** The editor's ways to bring files in, under the workspace in the sources panel. */
  importers: Snippet<[{ busy: boolean }]>
  /** The selected project and its actions. */
  inspector: Snippet<[{ selected: E | undefined; busy: boolean; now: number }]>
  /** Under the list, in the same scroll region (the 2D editor's templates). */
  below?: Snippet<[{ busy: boolean }]> | undefined
  /** The editor's dialogs over Home. */
  sheets?: Snippet<[{ selected: E | undefined }]> | undefined
} = $props()

/** The source's state right now (its store answers at once). */
function snapshot(from: ProjectListSource<E, B>): BrowserState<E, B> {
  let current: BrowserState<E, B> | undefined
  from.state.subscribe((value) => {
    current = value
  })()
  if (current === undefined) throw new Error('the project list gave no state')
  return current
}

// svelte-ignore state_referenced_locally
let view = $state.raw<BrowserState<E, B>>(snapshot(source))
$effect(() => source.state.subscribe((next) => (view = next)))

// Home reads the workspace whenever it appears, so coming back from a document shows what that document did.
onMount(() => {
  void source.refresh()
})

let panelOpen = $state(false)
let inspectorOpen = $state(false)
let scroller = $state<HTMLElement>()

const mode = $derived(shellModeOf(geometry.current.formFactor))
const selectedEntry = $derived(view.visible.find((entry) => entry.path === view.selected))
const cards = $derived(view.visible.map(card))
const busy = $derived(view.busy !== undefined)
// Ages are told against the time of the last change to the list, so they are fresh whenever the list is.
const now = $derived.by(() => {
  void view
  return clock.now()
})

/** Puts the focus back on the list, as after a deletion. */
export function focusList(): void {
  scroller?.querySelector<HTMLElement>('[role="listbox"]')?.focus()
}

function select(path: string): void {
  source.select(path)
  if (mode !== 'wide') inspectorOpen = true
}

function onSearchKeydown(event: KeyboardEvent): void {
  // Escape clears the text first; the drawers only hear it when there is nothing to clear.
  if (event.key === 'Escape' && view.query !== '') {
    event.stopPropagation()
    source.search('')
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
    <SourcesPanel {workspace} count={view.entries.length}>
      {#snippet importers()}{@render importersOf({ busy })}{/snippet}
    </SourcesPanel>
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
          oninput={(event) => source.search(event.currentTarget.value)}
          onkeydown={onSearchKeydown}
        />
      </header>

      {#if view.phase === 'unavailable'}
        <UnavailableNotice
          message={view.message ?? 'The workspace could not be read.'}
          onretry={() => source.refresh()}
        />
      {:else}
        <ProjectList
          loading={view.phase === 'loading'}
          total={view.entries.length}
          visible={cards}
          selected={view.selected}
          query={view.query}
          {emptyHint}
          {now}
          onselect={select}
          onstep={(key) => source.step(key)}
          {onopen}
          {ondelete}
          onclear={() => source.search('')}
        />
      {/if}

      {#if below}{@render below({ busy })}{/if}
    </div>
  {/snippet}

  {#snippet inspector()}
    {@render inspectorOf({ selected: selectedEntry, busy, now })}
  {/snippet}

  {#snippet status()}
    <StatusLine save={workspace.persistent ? 'saved' : 'device'} />
  {/snippet}

  {#snippet sheets()}
    {#if sheetsOf}{@render sheetsOf({ selected: selectedEntry })}{/if}
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
