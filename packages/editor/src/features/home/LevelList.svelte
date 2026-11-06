<!--
  Home's levels: one column of cards, newest first, or what stands in for them (a loading placeholder, "No levels yet"
  with the way to make one, or "Nothing matches" with Clear search).

  The list has one tab stop, the selected card, so a tablet with a keyboard Tabs past it at once. The arrow keys, Home
  and End move the selection and the focus with it; Enter opens (the card is a button); Delete asks to delete the
  selected level. The cards draw themselves (`ProjectCard`); this component owns only the keys and the focus. It does
  not scroll: Home's column is the scroll region.
-->
<script lang="ts">
import { tick } from 'svelte'
import type { HomeCard, StepKey } from '../../shared/kit/home/project-browse'
import Button from '../../shared/kit/widgets/Button.svelte'
import ProjectCard, { type CardAction } from './ProjectCard.svelte'

interface Props {
  loading: boolean
  /** How many levels there are before the search. */
  total: number
  /** The cards the search leaves, in list order. */
  visible: readonly HomeCard[]
  selected: string | undefined
  query: string
  now: number
  busy: boolean
  menu: 'popover' | 'sheet'
  onselect: (path: string) => void
  onstep: (key: StepKey) => void
  onaction: (path: string, action: CardAction) => void
  /** Makes a level; absent on a game folder, where Home makes none (the try-it page has the templates). */
  onnew?: (() => void) | undefined
  onclear: () => void
}

const {
  loading,
  total,
  visible,
  selected,
  query,
  now,
  busy,
  menu,
  onselect,
  onstep,
  onaction,
  onnew,
  onclear,
}: Props = $props()

let list = $state<HTMLElement>()
const STEP_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
])

/** Puts the focus on the selected card, as after a key moved it or a level was deleted. */
export function focusSelected(): void {
  list?.querySelector<HTMLElement>('[data-selected="true"] .open')?.focus()
}

async function onkeydown(event: KeyboardEvent): Promise<void> {
  // Only keys on a card itself: the More menu has keys of its own, and a key with a modifier belongs to the browser.
  const onCard = event.target instanceof HTMLElement && event.target.classList.contains('open')
  if (!onCard || event.altKey || event.ctrlKey || event.metaKey) return
  if (STEP_KEYS.has(event.key)) {
    event.preventDefault()
    onstep(event.key as StepKey)
    await tick()
    focusSelected()
  } else if (event.key === 'Delete' && selected !== undefined) {
    event.preventDefault()
    onaction(selected, 'delete')
  }
}
</script>

{#if loading}
  <div class="placeholders" role="status" aria-label="Loading levels" aria-busy="true">
    {#each [0, 1, 2] as n (n)}<span class="placeholder"></span>{/each}
  </div>
{:else if total === 0}
  <div class="empty">
    <p class="headline">No levels yet</p>
    {#if onnew}
      <p>Make your first one to start drawing.</p>
      <Button variant="primary" disabled={busy} onclick={onnew}>New level</Button>
    {:else}
      <p>Your game has no levels to edit yet.</p>
    {/if}
  </div>
{:else if visible.length === 0}
  <div class="empty">
    <p class="headline">Nothing matches “{query}”.</p>
    <Button onclick={onclear}>Clear search</Button>
  </div>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <ul aria-label="Levels" bind:this={list} {onkeydown}>
    {#each visible as card (card.path)}
      <ProjectCard
        {card}
        selected={card.path === selected}
        {now}
        {busy}
        {menu}
        onfocus={() => onselect(card.path)}
        onaction={(action) => onaction(card.path, action)}
      />
    {/each}
  </ul>
{/if}

<style>
  ul,
  .placeholders {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .placeholder {
    height: 6rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--paper);
    opacity: 0.6;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-5);
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-lg);
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
