<!--
  The suite's switcher (the same rail pattern as the document's view rail): the entries as tabs, a column beside the
  canvas in `wide` and the 64 px tab bar along the foot below it. One tab stop: arrow keys, Home and End move along it,
  and the focus follows the choice. Cmd or Ctrl with 1 to 9 chooses an entry in rail order from anywhere on the page.
  The bar never shrinks a tab: the tabs that do not fit at their size go under a last tab, "More", which opens a menu of
  them by name; the open editor is always one of the shown tabs (`railFit`).
  On Home no entry is chosen and the first tab is the tab stop. Every tab is at least 44 px. Each tab is its icon
  above its name, as an app's tab bar draws it: the name stays (an icon alone would make a person guess), the icon lets
  the eye find the editor without reading.
-->
<script lang="ts">
import { tick } from 'svelte'
import Icon from '../../../shared/kit/icons/Icon.svelte'
import Menu from '../../../shared/kit/widgets/Menu.svelte'
import { railFit } from './rail-fit'
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

// The bar's own width and each tab's natural width, measured from a hidden row that draws every tab (and More) at its
// size, so the fit does not depend on which tabs are drawn now.
let bar = $state<HTMLElement>()
let ruler = $state<HTMLElement>()
let room = $state(0)
let widths = $state<number[]>([])
let moreWidth = $state(0)
// Until every tab is measured (and wherever the bar has no layout) all of them are drawn.
const fit = $derived(
  orientation === 'horizontal' && widths.length === entries.length
    ? railFit(
        widths,
        room,
        entries.findIndex((entry) => entry.id === current),
        moreWidth,
      )
    : { shown: entries.map((_, index) => index), more: [] },
)
const shown = $derived(
  fit.shown.map((index) => entries[index]).filter((entry): entry is SuiteEntry => entry !== undefined),
)
const folded = $derived(
  fit.more.map((index) => entries[index]).filter((entry): entry is SuiteEntry => entry !== undefined),
)

function measure(): void {
  if (bar === undefined || ruler === undefined) return
  room = bar.clientWidth
  const sizes = [...ruler.children].map((child) => Math.ceil(child.getBoundingClientRect().width))
  moreWidth = sizes.pop() ?? 0
  widths = sizes
}

$effect(() => {
  void entries
  void orientation
  void tick().then(measure)
  void document.fonts?.ready.then(measure)
})

$effect(() => {
  if (bar === undefined || typeof ResizeObserver === 'undefined') return
  const watch = new ResizeObserver(measure)
  watch.observe(bar)
  return () => watch.disconnect()
})

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

<div class="bar" data-orientation={orientation} bind:this={bar}>
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
    {#each shown as entry (entry.id)}
      <button
        type="button"
        role="tab"
        data-entry={entry.id}
        aria-selected={entry.id === current}
        tabindex={entry.id === stop ? 0 : -1}
        onclick={() => onselect(entry.id)}
        ><Icon name={entry.icon} size={18} /><span class="label">{entry.label}</span></button
      >
    {/each}
  </div>
  {#if folded.length > 0}
    <div class="more">
      <Menu
        label="More"
        presentation="sheet"
        items={folded.map((entry) => ({ id: entry.id, label: entry.label }))}
        onselect={onselect}
      >
        {#snippet trigger()}<Icon name="more" size={18} /><span class="label">More</span>{/snippet}
      </Menu>
    </div>
  {/if}
  {#if orientation === 'horizontal'}
    <!-- Every tab and More at their natural size, to measure; never seen, never reached. -->
    <div class="ruler" bind:this={ruler} aria-hidden="true" inert>
      {#each entries as entry (entry.id)}
        <button type="button" tabindex="-1"><Icon name={entry.icon} size={18} /><span class="label">{entry.label}</span></button>
      {/each}
      <button type="button" tabindex="-1"><Icon name="more" size={18} /><span class="label">More</span></button>
    </div>
  {/if}
</div>

<style>
  .bar {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    position: relative;
  }
  .bar[data-orientation='horizontal'] {
    flex-direction: row;
  }
  .rail {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    gap: var(--space-1);
    /* The column's full width goes to the tabs: "Characters" needs 56 px of the 68 px rail. */
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
  /* Quiet until chosen: grey icon and name, the chosen tab in ink on the hover wash, as the top bar's tabs. */
  button {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: var(--size-hit);
    min-height: 52px;
    padding: var(--space-1) 0;
    border: 0;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: color 120ms var(--ease-out), background 120ms var(--ease-out);
  }
  .rail[data-orientation='horizontal'] button,
  .ruler button {
    flex: 1 0 auto;
    min-height: 56px;
    padding: var(--space-1) var(--space-2);
  }
  .ruler {
    position: absolute;
    display: flex;
    height: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }
  .ruler button {
    flex: 0 0 auto;
  }
  /* More looks like a tab: Menu's button, without its border and fill, an icon over its name. */
  .more {
    display: flex;
    flex: 0 0 auto;
  }
  .more :global([data-widget='menu']) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 56px;
    padding: var(--space-1) var(--space-2);
    border: 0;
    background: transparent;
    color: var(--muted);
  }
  .more :global([data-widget='menu']) :global(.label) {
    font: var(--text-eyebrow-11);
    font-weight: 500;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  /* The eyebrow size, a step lighter and a hair tighter, fits "Characters" whole in the 68 px rail. */
  .label {
    max-width: 100%;
    overflow: hidden;
    font: var(--text-eyebrow-11);
    font-weight: 500;
    letter-spacing: -0.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (hover: hover) {
    button:hover {
      color: var(--ink);
    }
  }
  button[aria-selected='true'] {
    background: var(--surface);
    color: var(--ink);
  }
  /* Along the foot the chosen tab is marked by ink and a line along its top edge, not a wash over a third of it. */
  .rail[data-orientation='horizontal'] button[aria-selected='true'] {
    background: none;
    box-shadow: inset 0 2px 0 var(--ink);
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
</style>
