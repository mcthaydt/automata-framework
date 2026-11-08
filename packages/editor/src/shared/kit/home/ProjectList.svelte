<!--
  The projects of the workspace: one listbox with one tab stop, so a tablet with a
  keyboard reaches everything below it with a single Tab. The listbox keeps focus and points at the selected card
  (`aria-activedescendant`); arrows (left and right, up and down alike), Home and End step through the list in order
  whatever the number of columns, Enter opens, Delete asks to delete. A click or a tap selects; a double click opens,
  and so does a second tap of a finger or pen on the card that is already selected (a mouse needs the double click, so
  a click to read a card never opens it). Loading, an empty workspace and a search that finds nothing are drawn here
  instead of the listbox. The list stays out of scrolling: the screen around it owns the scroll region.
-->
<script lang="ts">
import Button from '../widgets/Button.svelte'
import ProjectCard from './ProjectCard.svelte'
import type { HomeCard, StepKey } from './project-browse'

interface Props {
  /** The first listing has not come back yet. */
  loading: boolean
  /** How many projects the workspace holds, before the search. */
  total: number
  /** The cards of the projects the search leaves, in list order. */
  visible: readonly HomeCard[]
  selected: string | undefined
  query: string
  /** How to start a project, under "No projects yet". */
  emptyHint: string
  /** The time the ages on the cards are told against. */
  now: number
  onselect: (path: string) => void
  onstep: (key: StepKey) => void
  onopen: (path: string) => void
  /** Delete was pressed on the selected project; without it the key does nothing. */
  ondelete?: (() => void) | undefined
  onclear: () => void
}

const {
  loading,
  total,
  visible,
  selected,
  query,
  emptyHint,
  now,
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
  } else if (event.key === 'Delete' && selected !== undefined && ondelete !== undefined) {
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
    <p>{emptyHint}</p>
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
    {#each visible as card, index (card.path)}
      <ProjectCard
        id={cardId(index)}
        {card}
        selected={card.path === selected}
        {now}
        onpointerdown={(event) => pressed(event, card.path)}
        onclick={() => clicked(card.path)}
        ondblclick={() => onopen(card.path)}
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
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .placeholder {
    min-height: 6.5rem;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--paper);
    opacity: 0.6;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-4);
    border: 1px dashed var(--line-strong);
    border-radius: var(--edge-lg);
    color: var(--muted);
    font: var(--text-body-13);
  }
  .empty p {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .headline {
    color: var(--ink);
    font: var(--text-title-15);
  }
</style>
