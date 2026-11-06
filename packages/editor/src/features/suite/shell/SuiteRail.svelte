<!--
  The suite's switcher (the same rail pattern as the document's view rail): the nine entries as tabs, a
  column beside the canvas in `wide` and the 64 px tab bar along the foot below it. One tab stop: arrow keys, Home and
  End move along it, and the focus follows the choice. Cmd or Ctrl with 1 to 9 chooses an entry in rail order from
  anywhere on the page; the chosen tab scrolls into view.
  On Home no entry is chosen and the first tab is the tab stop. Every tab is at least 44 px.
-->
<script lang="ts">
import { tick } from 'svelte'
import type { SuiteEntry } from './suite-entries'

interface Props {
  entries: readonly SuiteEntry[]
  current: string | undefined
  orientation: 'vertical' | 'horizontal'
  onselect: (id: string) => void
}

const { entries, current, orientation, onselect }: Props = $props()

let list = $state<HTMLElement>()
const stop = $derived(entries.some((entry) => entry.id === current) ? current : entries[0]?.id)

// The chosen tab scrolls into view (the phone's bar scrolls); a choice made from the rail keeps the focus on the
// rail, on the tab now chosen.
$effect(() => {
  const chosen = current
  if (list === undefined) return
  const rail = list
  const focused = rail.contains(document.activeElement)
  void tick().then(() => {
    const tab = rail.querySelector<HTMLElement>(`[data-entry="${chosen}"]`)
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    if (focused) tab?.focus()
  })
})

function step(event: KeyboardEvent): void {
  const back = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  const forward = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
  const index = entries.findIndex((entry) => entry.id === stop)
  const next =
    event.key === back
      ? index - 1
      : event.key === forward
        ? index + 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? entries.length - 1
            : undefined
  if (next === undefined || entries.length === 0) return
  event.preventDefault()
  const target = entries[(next + entries.length) % entries.length]
  if (target !== undefined) onselect(target.id)
}

function shortcut(event: KeyboardEvent): void {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
  const digit = Number.parseInt(event.key, 10)
  const target = digit >= 1 ? entries[digit - 1] : undefined
  if (target === undefined) return
  event.preventDefault()
  onselect(target.id)
}
</script>

<svelte:window onkeydown={shortcut} />

<div
  class="rail"
  role="tablist"
  aria-label="Editors"
  aria-orientation={orientation}
  data-orientation={orientation}
  data-scroll-region={orientation === 'horizontal' ? 'both' : ''}
  tabindex="-1"
  bind:this={list}
  onkeydown={step}
>
  {#each entries as entry (entry.id)}
    <button
      type="button"
      role="tab"
      data-entry={entry.id}
      aria-selected={entry.id === current}
      tabindex={entry.id === stop ? 0 : -1}
      onclick={() => onselect(entry.id)}>{entry.label}</button
    >
  {/each}
</div>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    gap: var(--space-1);
    /* The column's full width goes to the tabs: "Schematic" needs about 54 px of the 56 px rail. */
    padding: var(--space-1) 0;
    overflow-y: auto;
  }
  /* Nine 44 px tabs need 396 px: on a phone the bar is a declared sideways scroll region rather than smaller targets. */
  .rail[data-orientation='horizontal'] {
    flex-direction: row;
    gap: 0;
    padding: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  button {
    flex: 0 0 auto;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-dim);
    /* The eyebrow size, a step lighter and a hair tighter, fits "Schematic" whole in the 56 px rail. */
    font: var(--text-eyebrow-11);
    font-weight: 500;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .rail[data-orientation='horizontal'] button {
    flex: 1 0 auto;
    padding: 0 var(--space-2);
  }
  button[aria-selected='true'] {
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
  }
</style>
