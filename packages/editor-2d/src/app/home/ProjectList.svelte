<!--
  The projects of the workspace (plan ED2D.4c2a, decision 3): one listbox with one tab stop, so a tablet with a
  keyboard reaches everything below it with a single Tab. The listbox keeps focus and points at the selected card
  (`aria-activedescendant`); arrows (left and right, up and down alike), Home and End step through the list in order
  whatever the number of columns, Enter opens, Delete asks to delete. A click or a tap selects; a double click opens,
  and so does a second tap of a finger or pen on the card that is already selected (a mouse needs the double click, so
  a click to read a card never opens it). Loading, an empty workspace and a search that finds nothing are drawn here
  instead of the listbox. The list stays out of scrolling: the screen around it owns the scroll region.
-->
<script lang="ts">
import type { LevelThumbnails } from '../../canvas/level-thumbnails'
import type { ProfileRegistry } from '../../profiles/profile'
import Button from '../controls/Button.svelte'
import type { ProjectEntry } from '../project-list'
import { kindTone, type StepKey } from './home-model'
import ProjectCard from './ProjectCard.svelte'

interface Props {
  /** The first listing has not come back yet. */
  loading: boolean
  /** How many projects the workspace holds, before the search. */
  total: number
  /** The projects the search leaves, in list order. */
  visible: readonly ProjectEntry[]
  selected: string | undefined
  query: string
  registry: ProfileRegistry
  /** The time the ages on the cards are told against. */
  now: number
  /** Draws the cards' preview levels (ED2D.4c3b); absent, every card shows its initial. */
  thumbnails?: LevelThumbnails | undefined
  onselect: (path: string) => void
  onstep: (key: StepKey) => void
  onopen: (path: string) => void
  ondelete: () => void
  onclear: () => void
}

const {
  loading,
  total,
  visible,
  selected,
  query,
  registry,
  now,
  thumbnails,
  onselect,
  onstep,
  onopen,
  ondelete,
  onclear,
}: Props = $props()

const uid = $props.id()
let listbox = $state<HTMLElement>()

const STEP_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
])
const cardId = (index: number): string => `${uid}-card-${index}`
const activeId = $derived.by(() => {
  const at = visible.findIndex((entry) => entry.path === selected)
  return at === -1 ? undefined : cardId(at)
})

function onkeydown(event: KeyboardEvent): void {
  // Alt+Left is the browser's Back, Ctrl+Home belongs to the page: keys with a modifier are not ours.
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (STEP_KEYS.has(event.key)) {
    event.preventDefault()
    onstep(event.key as StepKey)
  } else if (event.key === 'Enter' && selected !== undefined) {
    event.preventDefault()
    onopen(selected)
  } else if (event.key === 'Delete' && selected !== undefined) {
    event.preventDefault()
    ondelete()
  }
}

// What the last press was, to tell a second tap on the selected card from the first one: the click that follows a
// press cannot see whether the card was selected before the press changed anything.
let press: { path: string; byFinger: boolean; wasSelected: boolean } | undefined

function pressed(event: PointerEvent, path: string): void {
  press = {
    path,
    byFinger: event.pointerType === 'touch' || event.pointerType === 'pen',
    wasSelected: path === selected,
  }
}

function clicked(path: string): void {
  const mine = press?.path === path ? press : undefined
  press = undefined
  if (mine?.byFinger && mine.wasSelected) onopen(path)
  else onselect(path)
}

// Keeps the selected card in view as the keys move it. Not every browser (and not jsdom) has the method.
$effect(() => {
  void selected
  listbox?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
})
</script>

{#if loading}
  <div class="skeleton" role="status" aria-label="Loading projects" aria-busy="true">
    {#each [0, 1, 2] as n (n)}<span class="placeholder"></span>{/each}
  </div>
{:else if total === 0}
  <div class="empty">
    <p class="headline">No projects yet</p>
    <p>Pick a template below to start one.</p>
  </div>
{:else if visible.length === 0}
  <div class="empty">
    <p class="headline">Nothing matches “{query}”.</p>
    <Button onclick={onclear}>Clear search</Button>
  </div>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="list"
    role="listbox"
    aria-label="Projects"
    tabindex="0"
    aria-activedescendant={activeId}
    bind:this={listbox}
    {onkeydown}
  >
    {#each visible as entry, index (entry.path)}
      <ProjectCard
        id={cardId(index)}
        {entry}
        selected={entry.path === selected}
        accent={entry.status === 'ambiguous' ? '--color-text-dim' : kindTone(registry, entry.profile.id)}
        {now}
        {thumbnails}
        onpointerdown={(event) => pressed(event, entry.path)}
        onclick={() => clicked(entry.path)}
        ondblclick={() => onopen(entry.path)}
      />
    {/each}
  </div>
{/if}

<style>
  .list,
  .skeleton {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
    gap: var(--space-3);
  }
  .list {
    outline: none;
  }
  /* The listbox holds the focus, so the ring is drawn on the card it points at. */
  .list:focus-visible :global([aria-selected='true']) {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  .placeholder {
    min-height: 6.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background: var(--color-bg-surface);
    opacity: 0.6;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-4);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-lg);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .empty p {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .headline {
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
</style>
