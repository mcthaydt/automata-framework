<!--
  Choose one thing from a list (kit spec §4.6): a layer, a tileset, a texture, an entity. The closed picker shows
  the chosen option or the placeholder; opened on a `Popup` it is a listbox, optionally under group headings and
  with a search field (on by default above eight options, `searchable` decides otherwise).

  Focus stays in one place, the search field or the list itself, and the active option is announced through
  `aria-activedescendant`. ArrowUp and ArrowDown move through the enabled options and wrap; in the list Home and
  End go to the ends (in the field they move the caret); Enter picks. Typing filters by label and detail; with
  nothing left it says so and Enter picks nothing. A disabled option stays in the list, says why and calls
  `onblocked` when pressed, but keyboard movement skips it.
-->
<script lang="ts">
import { tick } from 'svelte'
import type { BlockedProps } from './edit-event'
import Popup from './Popup.svelte'
import { filterOptions, groupOptions, type PickerOption } from './picker-model'
import { nextEnabled } from './widget-math'

/** Past this many options a picker gets a search field unless told otherwise. */
const SEARCH_ABOVE = 8

interface Props extends BlockedProps {
  label: string
  options: readonly PickerOption[]
  value?: string | undefined
  placeholder?: string
  presentation?: 'popover' | 'sheet'
  searchable?: boolean | undefined
  onpick?: ((id: string) => void) | undefined
}

let {
  label,
  options,
  value = $bindable(),
  placeholder = 'Choose',
  presentation = 'popover',
  searchable,
  onpick,
  disabled = false,
  reason,
  onblocked,
}: Props = $props()

const uid = $props.id()
let open = $state(false)
let anchor = $state<HTMLElement>()
let list = $state<HTMLElement>()
let field = $state<HTMLInputElement>()
let query = $state('')
let active = $state<string>()

const selected = $derived(options.find((option) => option.id === value))
const searchOn = $derived(searchable ?? options.length > SEARCH_ABOVE)
const visible = $derived(filterOptions(options, query))
const groups = $derived(groupOptions(visible))
// The order the eye reads the list in, which groups can change.
const ordered = $derived(groups.flatMap((group) => group.options))
const isOff = (option: PickerOption): boolean => option.disabled === true
const enabledAt = (index: number): boolean => !isOff(ordered[index] as PickerOption)
const domId = (option: PickerOption): string => `${uid}-option-${options.indexOf(option)}`
const activeDomId = $derived.by(() => {
  const option = ordered.find((candidate) => candidate.id === active)
  return option ? domId(option) : undefined
})

function firstEnabled(): string | undefined {
  return ordered.find((option) => !isOff(option))?.id
}

function setActive(id: string | undefined): void {
  active = id
  const option = ordered.find((candidate) => candidate.id === id)
  if (option)
    void tick().then(() => document.getElementById(domId(option))?.scrollIntoView?.({ block: 'nearest' }))
}

function openPicker(): void {
  if (disabled) {
    onblocked?.(reason)
    return
  }
  if (open) {
    open = false
    return
  }
  query = ''
  const chosen = ordered.find((option) => option.id === value)
  active = chosen && !isOff(chosen) ? chosen.id : firstEnabled()
  open = true
}

function onopened(): void {
  const target = searchOn ? field : list
  target?.focus()
  setActive(active)
}

function pick(option: PickerOption): void {
  if (isOff(option)) {
    onblocked?.(option.reason)
    return
  }
  value = option.id
  open = false
  onpick?.(option.id)
}

function move(direction: 1 | -1 | 'first' | 'last'): void {
  const from = ordered.findIndex((option) => option.id === active)
  const index =
    direction === 'first'
      ? nextEnabled(ordered.length, -1, 1, enabledAt)
      : direction === 'last'
        ? nextEnabled(ordered.length, -1, -1, enabledAt)
        : nextEnabled(ordered.length, from, direction, enabledAt)
  if (index !== undefined) setActive(ordered[index]?.id)
}

function onQuery(): void {
  active = firstEnabled()
}

function onTriggerKey(event: KeyboardEvent): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  openPicker()
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') move(1)
  else if (event.key === 'ArrowUp') move(-1)
  else if (event.key === 'Enter') {
    const option = ordered.find((candidate) => candidate.id === active)
    if (option) pick(option)
  } else if (!searchOn && event.key === 'Home') move('first')
  else if (!searchOn && event.key === 'End') move('last')
  else return
  event.preventDefault()
}
</script>

<button
  type="button"
  class="trigger"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-label={`${label}: ${selected?.label ?? placeholder}`}
  aria-disabled={disabled || undefined}
  aria-describedby={disabled && reason ? `${uid}-reason` : undefined}
  title={disabled ? reason : undefined}
  data-widget="picker"
  bind:this={anchor}
  onclick={openPicker}
  onkeydown={onTriggerKey}
>
  <span class="name" aria-hidden="true">{label}</span>
  <span class="value" data-placeholder={selected ? undefined : ''} aria-hidden="true">
    {selected?.label ?? placeholder}
  </span>
</button>
{#if disabled && reason}<span class="reason" id={`${uid}-reason`}>{reason}</span>{/if}

{#snippet row(option: PickerOption)}
  <!-- svelte-ignore a11y_click_events_have_key_events -- the field or the list handles the keys (aria-activedescendant) -->
  <div
    class="option"
    role="option"
    tabindex="-1"
    id={domId(option)}
    data-active={option.id === active ? '' : undefined}
    aria-selected={option.id === value}
    aria-disabled={isOff(option) || undefined}
    aria-describedby={isOff(option) && option.reason ? `${domId(option)}-reason` : undefined}
    onclick={() => pick(option)}
  >
    <span class="label">{option.label}</span>
    {#if option.detail}<span class="detail">{option.detail}</span>{/if}
  </div>
  {#if isOff(option) && option.reason}
    <span class="reason" id={`${domId(option)}-reason`}>{option.reason}</span>
  {/if}
{/snippet}

<Popup bind:open {anchor} {presentation} {label} {onopened}>
  <div class="picker">
    {#if searchOn}
      <input
        class="search"
        type="search"
        aria-label={`Search ${label}`}
        aria-controls={`${uid}-list`}
        aria-activedescendant={activeDomId}
        autocomplete="off"
        spellcheck="false"
        bind:this={field}
        bind:value={query}
        oninput={onQuery}
        onkeydown={onKey}
      />
    {/if}
    <!-- Presses must not take focus from the field or the list: the active option is only announced. -->
    <div
      class="list"
      role="listbox"
      id={`${uid}-list`}
      aria-label={label}
      tabindex={searchOn ? -1 : 0}
      aria-activedescendant={searchOn ? undefined : activeDomId}
      bind:this={list}
      onkeydown={searchOn ? undefined : onKey}
      onmousedown={(event) => event.preventDefault()}
    >
      {#each groups as group (group.heading ?? '')}
        {#if group.heading !== undefined}
          <div class="group" role="group" aria-label={group.heading}>
            <div class="heading" aria-hidden="true">{group.heading}</div>
            {#each group.options as option (option.id)}{@render row(option)}{/each}
          </div>
        {:else}
          {#each group.options as option (option.id)}{@render row(option)}{/each}
        {/if}
      {/each}
    </div>
    {#if ordered.length === 0}
      <p class="empty" role="status">No matches for “{query.trim()}”</p>
    {/if}
  </div>
</Popup>

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    cursor: pointer;
  }
  .trigger[aria-disabled='true'] {
    opacity: 0.45;
  }
  .trigger:focus-visible,
  .search:focus-visible,
  .list:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
  }
  .name {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .value[data-placeholder] {
    color: var(--color-text-dim);
  }
  .picker {
    display: flex;
    flex-direction: column;
    min-width: min(16rem, 100%);
  }
  .search {
    min-height: var(--size-hit);
    margin: var(--space-1);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .list {
    display: flex;
    flex-direction: column;
    padding: var(--space-1);
    outline: none;
  }
  .heading {
    padding: var(--space-2) var(--space-3) var(--space-1);
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border-radius: var(--radius-sm);
    font: var(--text-body-13);
    cursor: pointer;
  }
  .option[data-active] {
    background: var(--color-accent-soft);
  }
  .option[aria-selected='true'] .label {
    color: var(--color-accent-default);
    font: var(--text-body-13-medium);
  }
  .option[aria-disabled='true'] {
    opacity: 0.45;
  }
  .detail {
    color: var(--color-text-dim);
    font: var(--text-mono-12);
  }
  .empty {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    color: var(--color-text-dim);
    font: var(--text-body-13);
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
