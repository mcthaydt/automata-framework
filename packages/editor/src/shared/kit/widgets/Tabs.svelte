<!--
  A row of tabs over one panel (kit spec §4.6). Arrows choose the next enabled tab and wrap, Home and End go to the
  ends, and choosing activates, so the panel always follows focus. Only the chosen tab is in the tab order; the
  panel is the single `tabpanel`, named by its tab. A disabled tab stays focusable by touch and mouse: pressing it
  calls `onblocked` with its reason, which is also its accessible description.
-->
<script lang="ts">
import { type Snippet, tick } from 'svelte'
import type { BlockedProps } from './edit-event'
import { nextEnabled } from './widget-math'

interface Tab {
  id: string
  label: string
  disabled?: boolean | undefined
  reason?: string | undefined
}

interface Props extends Pick<BlockedProps, 'onblocked'> {
  label: string
  tabs: readonly Tab[]
  value: string
  onselect?: ((id: string) => void) | undefined
  /** The panel for the chosen tab. */
  panel: Snippet<[string]>
}

let { label, tabs, value = $bindable(), onselect, onblocked, panel }: Props = $props()

const uid = $props.id()
let buttons = $state<HTMLElement[]>([])

const tabId = (id: string): string => `${uid}-tab-${id}`
const selectedIndex = $derived(tabs.findIndex((tab) => tab.id === value))
// The tab stop is the chosen tab, or the first enabled one when nothing is chosen.
const stop = $derived(
  selectedIndex >= 0 && tabs[selectedIndex]?.disabled !== true
    ? selectedIndex
    : (nextEnabled(tabs.length, -1, 1, (i) => tabs[i]?.disabled !== true) ?? 0),
)

function choose(tab: Tab): boolean {
  if (tab.disabled === true) {
    onblocked?.(tab.reason)
    return false
  }
  if (tab.id !== value) {
    value = tab.id
    onselect?.(tab.id)
  }
  return true
}

async function move(index: number | undefined): Promise<void> {
  const tab = index === undefined ? undefined : tabs[index]
  if (index === undefined || tab === undefined || !choose(tab)) return
  await tick()
  buttons[index]?.focus()
}

function onKey(event: KeyboardEvent, index: number): void {
  const enabled = (i: number): boolean => tabs[i]?.disabled !== true
  let target: number | undefined
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
    target = nextEnabled(tabs.length, index, 1, enabled)
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    target = nextEnabled(tabs.length, index, -1, enabled)
  else if (event.key === 'Home') target = nextEnabled(tabs.length, -1, 1, enabled)
  else if (event.key === 'End') target = nextEnabled(tabs.length, -1, -1, enabled)
  else return
  event.preventDefault()
  void move(target)
}
</script>

<div class="tabs" data-widget="tabs">
  <div class="list" role="tablist" aria-label={label}>
    {#each tabs as tab, index (tab.id)}
      <button
        type="button"
        class="tab"
        role="tab"
        id={tabId(tab.id)}
        aria-selected={tab.id === value}
        aria-controls={tab.id === value ? `${uid}-panel` : undefined}
        aria-disabled={tab.disabled === true || undefined}
        aria-describedby={tab.disabled === true && tab.reason ? `${uid}-reason-${tab.id}` : undefined}
        tabindex={index === stop ? 0 : -1}
        title={tab.disabled === true ? tab.reason : undefined}
        bind:this={buttons[index]}
        onclick={() => choose(tab)}
        onkeydown={(event) => onKey(event, index)}
      >
        {tab.label}
      </button>
      {#if tab.disabled === true && tab.reason}
        <span class="reason" id={`${uid}-reason-${tab.id}`}>{tab.reason}</span>
      {/if}
    {/each}
  </div>
  {#if selectedIndex >= 0}
    <div class="panel" role="tabpanel" id={`${uid}-panel`} aria-labelledby={tabId(value)}>
      {@render panel(value)}
    </div>
  {/if}
</div>

<style>
  .tabs {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .list {
    display: flex;
    gap: var(--space-1);
    overflow-x: auto;
    border-bottom: 1px solid var(--color-border-default);
  }
  .tab {
    flex: 0 0 auto;
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--color-text-dim);
    font: var(--text-body-13-medium);
    cursor: pointer;
  }
  .tab[aria-selected='true'] {
    border-bottom-color: var(--color-accent-default);
    color: var(--color-text-primary);
  }
  .tab[aria-disabled='true'] {
    opacity: 0.45;
  }
  .tab:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
  }
  .panel {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
  }
  .reason {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
