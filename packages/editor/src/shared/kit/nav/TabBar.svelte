<!--
  The compact layout's tab bar: four editors and More, each its icon above its name, 56 px tall. The first four in the
  suite's order show, and the open editor takes the fourth slot when it would be under More (`tabSlots`). The open tab is
  `ink` with a 2 px lime bar along its top (down its left edge when the bar stands at the side of a phone held sideways).
  More opens a sheet with the rest by name. The tabs keep the `tab` role and their names, so a journey opens an editor
  through the bar the same way it does through the sidebar. Keyboard rules are the sidebar's (`rail-keys`).
-->
<script lang="ts">
import { tick } from 'svelte'
import Icon from '../icons/Icon.svelte'
import Sheet from '../sheets/Sheet.svelte'
import { shortcutTarget, stepTarget, tabStop } from './rail-keys'
import type { NavEntry } from './Sidebar.svelte'
import { tabSlots } from './tab-slots'

interface Props {
  entries: readonly NavEntry[]
  current: string | undefined
  /** Problems per editor id; shown as a dot-count on the tab. */
  counts?: Readonly<Record<string, number>>
  /** The bar stands at the left edge (a phone held sideways) rather than lying along the foot. */
  standing: boolean
  onselect: (id: string) => void
}

const { entries, current, counts = {}, standing, onselect }: Props = $props()

const slots = $derived(tabSlots(entries, current))
const orientation = $derived(standing ? 'vertical' : 'horizontal')
const stop = $derived(tabStop(slots.shown, current))
let moreOpen = $state(false)
let list = $state<HTMLElement>()

$effect(() => {
  const chosen = current
  const bar = list
  if (bar === undefined) return
  const focused = bar.contains(document.activeElement)
  void tick().then(() => {
    const tab = bar.querySelector<HTMLElement>(`[data-entry="${chosen}"]`)
    if (focused) tab?.focus()
  })
})

function step(event: KeyboardEvent): void {
  const target = stepTarget(slots.shown, stop, event.key, orientation)
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

function pick(id: string): void {
  moreOpen = false
  onselect(id)
}
</script>

<svelte:window onkeydown={shortcut} />

<div
  class="bar"
  role="tablist"
  aria-label="Editors"
  aria-orientation={orientation}
  data-standing={standing ? '' : undefined}
  tabindex="-1"
  bind:this={list}
  onkeydown={step}
>
  {#each slots.shown as entry (entry.id)}
    {@const count = counts[entry.id] ?? 0}
    <button
      type="button"
      role="tab"
      data-entry={entry.id}
      aria-selected={entry.id === current}
      aria-describedby={count > 0 ? `problems-${entry.id}` : undefined}
      tabindex={entry.id === stop ? 0 : -1}
      onclick={() => onselect(entry.id)}
    >
      <Icon name={entry.icon} size={20} /><span class="label">{entry.label}</span>
      {#if count > 0}<span class="count" aria-hidden="true">{count}</span>{/if}
    </button>
    {#if count > 0}<span class="hidden" id={`problems-${entry.id}`}>{count === 1 ? '1 problem' : `${count} problems`}</span>{/if}
  {/each}
  {#if slots.more.length > 0}
    <button type="button" class="more" aria-haspopup="dialog" aria-expanded={moreOpen} onclick={() => (moreOpen = true)}>
      <Icon name="more" size={20} /><span class="label">More</span>
    </button>
  {/if}
</div>

<Sheet open={moreOpen} label="More editors" onclose={() => (moreOpen = false)}>
  <ul class="more-list">
    {#each slots.more as entry (entry.id)}
      <li>
        <button type="button" class="more-item" data-more-entry={entry.id} onclick={() => pick(entry.id)}>
          <Icon name={entry.icon} size={20} /><span>{entry.label}</span>
        </button>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .bar {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
  .bar[data-standing] {
    flex-direction: column;
    overflow-y: auto;
  }
  button {
    position: relative;
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: var(--size-hit);
    min-height: 56px;
    padding: var(--space-1) 2px;
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .bar[data-standing] button {
    flex: none;
  }
  .label {
    max-width: 100%;
    overflow: hidden;
    font: var(--text-eyebrow-11);
    font-weight: 500;
    letter-spacing: -0.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button[aria-selected='true'] {
    color: var(--ink);
  }
  /* Where the open editor is: a lime bar along the top of its tab, or down the left of it when the bar stands. */
  button[aria-selected='true']::before {
    position: absolute;
    top: 0;
    left: 25%;
    right: 25%;
    height: 2px;
    background: var(--lime);
    content: '';
  }
  .bar[data-standing] button[aria-selected='true']::before {
    top: 25%;
    bottom: 25%;
    left: 0;
    right: auto;
    width: 2px;
    height: auto;
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .count {
    position: absolute;
    top: 4px;
    right: calc(50% - 20px);
    min-width: 16px;
    padding: 0 4px;
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
  .more-list {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0 var(--space-2) var(--space-2);
    list-style: none;
  }
  .more-item {
    flex-direction: row;
    justify-content: flex-start;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border-radius: var(--edge-sm);
    color: var(--ink);
    font: var(--text-body-13);
  }
</style>
