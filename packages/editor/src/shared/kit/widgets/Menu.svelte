<!--
  A menu button and its menu, the WAI-ARIA menu button pattern on a `Popup`. Enter, Space and
  ArrowDown open it with the first enabled item focused, ArrowUp with the last; arrows, Home and End move through
  the enabled items and wrap, type-ahead jumps by first letters, Enter or a press chooses (`onselect`, close,
  focus back on the trigger), and Escape or a press outside closes it. A disabled item stays in the menu, says why
  and calls `onblocked` when pressed, but keyboard movement skips it, as it does separators.

  `trigger` replaces the label text with something else (an icon); `label` still names the button and the menu.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import type { BlockedProps } from './edit-event'
import { advanceTypeahead, findTypeahead, type TypeaheadState } from './menu-model'
import Popup from './Popup.svelte'
import { nextEnabled } from './widget-math'

interface MenuItem {
  id: string
  label: string
  /** A shortcut or other hint, drawn at the end of the row. */
  detail?: string | undefined
  disabled?: boolean | undefined
  reason?: string | undefined
}

interface Props extends BlockedProps {
  label: string
  items: readonly (MenuItem | 'separator')[]
  presentation?: 'popover' | 'sheet'
  trigger?: Snippet | undefined
  onselect?: ((id: string) => void) | undefined
}

const {
  label,
  items,
  presentation = 'popover',
  trigger: triggerContent,
  onselect,
  disabled = false,
  reason,
  onblocked,
}: Props = $props()

const uid = $props.id()
let open = $state(false)
let anchor = $state<HTMLElement>()
let initial: 'first' | 'last' = 'first'
let current = $state<string>()
let ahead: TypeaheadState | undefined
let menu = $state<HTMLElement>()
const buttons: Record<string, HTMLElement | undefined> = {}

const entries = $derived(items.filter((item): item is MenuItem => item !== 'separator'))
const isOff = (entry: MenuItem): boolean => entry.disabled === true
const enabledAt = (index: number): boolean => !isOff(entries[index] as MenuItem)
const stopId = $derived(current ?? entries.find((entry) => !isOff(entry))?.id)

function openWith(which: 'first' | 'last'): void {
  if (disabled) {
    onblocked?.(reason)
    return
  }
  if (open) {
    open = false
    return
  }
  initial = which
  current = undefined
  ahead = undefined
  open = true
}

function focusEntry(index: number | undefined): void {
  const entry = index === undefined ? undefined : entries[index]
  if (entry === undefined) return
  current = entry.id
  buttons[entry.id]?.focus()
}

function onopened(): void {
  const first = nextEnabled(entries.length, -1, initial === 'first' ? 1 : -1, enabledAt)
  if (first === undefined) menu?.focus()
  else focusEntry(first)
}

function choose(entry: MenuItem): void {
  if (isOff(entry)) {
    onblocked?.(entry.reason)
    return
  }
  open = false
  onselect?.(entry.id)
}

function onTriggerKey(event: KeyboardEvent): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  openWith(event.key === 'ArrowDown' ? 'first' : 'last')
}

function onItemKey(event: KeyboardEvent, position: number): void {
  let target: number | undefined
  if (event.key === 'ArrowDown') target = nextEnabled(entries.length, position, 1, enabledAt)
  else if (event.key === 'ArrowUp') target = nextEnabled(entries.length, position, -1, enabledAt)
  else if (event.key === 'Home') target = nextEnabled(entries.length, -1, 1, enabledAt)
  else if (event.key === 'End') target = nextEnabled(entries.length, -1, -1, enabledAt)
  else if (event.key === 'Tab') {
    event.preventDefault()
    open = false
    return
  } else if (
    event.key.length === 1 &&
    event.key !== ' ' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    ahead = advanceTypeahead(ahead, event.key, performance.now())
    target = findTypeahead(
      entries.map((entry) => entry.label),
      ahead.text,
      position,
      enabledAt,
    )
    if (target !== undefined) event.preventDefault()
    focusEntry(target)
    return
  } else return
  ahead = undefined
  event.preventDefault()
  focusEntry(target)
}
</script>

<button
  type="button"
  class="trigger"
  aria-haspopup="menu"
  aria-expanded={open}
  aria-controls={open ? `${uid}-menu` : undefined}
  aria-label={triggerContent ? label : undefined}
  aria-disabled={disabled || undefined}
  aria-describedby={disabled && reason ? `${uid}-reason` : undefined}
  title={disabled ? reason : undefined}
  data-widget="menu"
  bind:this={anchor}
  onclick={() => openWith('first')}
  onkeydown={onTriggerKey}
>
  {#if triggerContent}{@render triggerContent()}{:else}{label}{/if}
</button>
{#if disabled && reason}<span class="reason" id={`${uid}-reason`}>{reason}</span>{/if}

<Popup bind:open {anchor} {presentation} {label} {onopened}>
  <div class="menu" role="menu" id={`${uid}-menu`} aria-label={label} tabindex="-1" bind:this={menu}>
    {#each items as item, index (item === 'separator' ? `separator-${index}` : item.id)}
      {#if item === 'separator'}
        <div class="separator" role="separator"></div>
      {:else}
        {@const position = entries.indexOf(item)}
        <button
          type="button"
          class="item"
          role="menuitem"
          aria-disabled={isOff(item) || undefined}
          aria-describedby={isOff(item) && item.reason ? `${uid}-reason-${item.id}` : undefined}
          tabindex={item.id === stopId ? 0 : -1}
          bind:this={buttons[item.id]}
          onfocus={() => (current = item.id)}
          onclick={() => choose(item)}
          onkeydown={(event) => onItemKey(event, position)}
        >
          <span class="label">{item.label}</span>
          {#if item.detail}<span class="detail">{item.detail}</span>{/if}
        </button>
        {#if isOff(item) && item.reason}
          <span class="reason" id={`${uid}-reason-${item.id}`}>{item.reason}</span>
        {/if}
      {/if}
    {/each}
  </div>
</Popup>

<style>
  .trigger {
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
    cursor: pointer;
  }
  .trigger[aria-disabled='true'] {
    opacity: 0.45;
  }
  .trigger:focus-visible,
  .item:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
  }
  .menu {
    display: flex;
    flex-direction: column;
    padding: var(--space-1);
    outline: none;
  }
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
  .item:hover,
  .item:focus {
    background: var(--color-accent-soft);
  }
  .item[aria-disabled='true'] {
    opacity: 0.45;
  }
  .detail {
    color: var(--color-text-dim);
    font: var(--text-mono-12);
  }
  .separator {
    height: 1px;
    margin: var(--space-1) var(--space-2);
    background: var(--color-border-default);
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
