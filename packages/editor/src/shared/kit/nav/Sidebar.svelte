<!--
  The editors' sidebar: the game's mark and name, Home, and every editor the page registers under "Editors", each as its own
  icon and its whole name. In the wide layout it is a 224 px column of rows; in the medium layout it folds to a 76 px rail
  with each icon above its name, never cut. The editors are a `tablist` named "Editors" of `tab`s named by the editor's
  name alone, so the journeys and a screen reader find them one way; a count of problems is drawn at the row's end but
  is not part of the name (the tab is described by "1 problem" instead). Home is a button outside the list.
  One tab stop: arrows, Home and End move along it; Cmd or Ctrl with 1 to 9 choose an editor from anywhere. The chosen
  tab scrolls into view and keeps the focus if it had it.
-->
<script lang="ts">
import { tick } from 'svelte'
import Icon from '../icons/Icon.svelte'
import type { IconName } from '../icons/paths'
import { shortcutTarget, stepTarget, tabStop } from './rail-keys'

export interface NavEntry {
  readonly id: string
  readonly label: string
  readonly icon: IconName
}

interface Props {
  /** The game's name in words, and the one letter that marks it. */
  game: { readonly name: string; readonly letter: string }
  entries: readonly NavEntry[]
  current: string | undefined
  /** Problems per editor id; an editor with none has no count. */
  counts?: Readonly<Record<string, number>>
  layout: 'sidebar' | 'rail'
  onselect: (id: string) => void
  onhome: () => void
}

const { game, entries, current, counts = {}, layout, onselect, onhome }: Props = $props()

let list = $state<HTMLElement>()
const stop = $derived(tabStop(entries, current))
const problems = (count: number): string => `${count} ${count === 1 ? 'problem' : 'problems'}`

$effect(() => {
  const chosen = current
  const column = list
  if (column === undefined) return
  const focused = column.contains(document.activeElement)
  void tick().then(() => {
    const tab = column.querySelector<HTMLElement>(`[data-entry="${chosen}"]`)
    tab?.scrollIntoView?.({ block: 'nearest' })
    if (focused) tab?.focus()
  })
})

function step(event: KeyboardEvent): void {
  const target = stepTarget(entries, stop, event.key, 'vertical')
  if (target === undefined) return
  event.preventDefault()
  onselect(target.id)
}

function shortcut(event: KeyboardEvent): void {
  const target = shortcutTarget(entries, event)
  if (target === undefined) return
  event.preventDefault()
  onselect(target.id)
}
</script>

<svelte:window onkeydown={shortcut} />

<div class="side" data-layout={layout}>
  <p class="game" title={game.name}>
    <span class="mark" aria-hidden="true">{game.letter}</span>
    <span class="name">{game.name}</span>
  </p>
  <button
    type="button"
    class="item home"
    aria-current={current === undefined ? 'page' : undefined}
    onclick={onhome}
  >
    <Icon name="home" size={18} /><span class="label">Home</span>
  </button>
  <p class="group" aria-hidden="true">Editors</p>
  <div
    class="editors"
    role="tablist"
    aria-label="Editors"
    aria-orientation="vertical"
    data-scroll-region=""
    tabindex="-1"
    bind:this={list}
    onkeydown={step}
  >
    {#each entries as entry (entry.id)}
      {@const count = counts[entry.id] ?? 0}
      <button
        type="button"
        role="tab"
        class="item"
        data-entry={entry.id}
        aria-selected={entry.id === current}
        aria-describedby={count > 0 ? `problems-${entry.id}` : undefined}
        tabindex={entry.id === stop ? 0 : -1}
        onclick={() => onselect(entry.id)}
      >
        <Icon name={entry.icon} size={18} /><span class="label">{entry.label}</span>
        {#if count > 0}<span class="count" aria-hidden="true">{count}</span>{/if}
      </button>
      {#if count > 0}<span class="hidden" id={`problems-${entry.id}`}>{problems(count)}</span>{/if}
    {/each}
  </div>
</div>

<style>
  .side {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    min-height: 0;
    padding: var(--space-2);
    box-sizing: border-box;
  }
  .game {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    margin: 0 0 var(--space-2);
    padding: var(--space-1);
    font: var(--text-title-15);
    color: var(--ink);
  }
  /* The game's mark: its first letter on a raised square with a lime foot, so a person knows which game this is. */
  .mark {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--raise);
    box-shadow: inset 0 -3px 0 var(--lime);
    font: var(--text-label-12);
    font-weight: 600;
    text-transform: uppercase;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .group {
    margin: var(--space-2) 0 0;
    padding: 0 var(--space-2);
    font: var(--text-label-12);
    color: var(--tool-faint);
  }
  .editors {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 0;
    overflow-y: auto;
  }
  .item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--muted);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
    transition: color 120ms var(--ease-out), background 120ms var(--ease-out);
  }
  @media (hover: hover) {
    .item:hover {
      background: var(--surface);
      color: var(--ink);
    }
  }
  .item[aria-selected='true'],
  .item[aria-current='page'] {
    background: var(--cobalt-soft);
    color: var(--ink);
  }
  .item:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    flex: none;
    min-width: 18px;
    padding: 0 5px;
    border-radius: var(--edge-sm);
    background: var(--raise);
    color: var(--warn);
    font: var(--text-mono-12);
    text-align: center;
  }
  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  /* The medium layout: a 76 px rail, each icon above its whole name at 11 px. */
  .side[data-layout='rail'] {
    align-items: stretch;
    padding: var(--space-2) 6px;
  }
  .side[data-layout='rail'] .game {
    justify-content: center;
    margin-bottom: var(--space-2);
  }
  .side[data-layout='rail'] .name,
  .side[data-layout='rail'] .group {
    display: none;
  }
  .side[data-layout='rail'] .item {
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    min-height: 52px;
    padding: var(--space-1) 2px;
    position: relative;
  }
  .side[data-layout='rail'] .label {
    flex: none;
    max-width: 100%;
    font: var(--text-eyebrow-11);
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .side[data-layout='rail'] .count {
    position: absolute;
    top: 3px;
    right: 6px;
  }
  @media (any-pointer: coarse) {
    .side[data-layout='rail'] .item {
      min-height: 56px;
    }
  }
</style>
