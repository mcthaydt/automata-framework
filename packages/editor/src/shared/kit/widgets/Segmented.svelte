<!--
  Two to five exclusive options in a row (kit spec §4.6), a radio group: arrows choose the next enabled option and
  wrap, Home and End go to the ends, and only the chosen option is in the tab order. A disabled option stays
  focusable by touch and mouse: pressing it calls `onblocked` with its reason, which is also its accessible
  description. Choosing is a `set` edit event.
-->
<script lang="ts">
import { tick } from 'svelte'
import type { BlockedProps, EditEvent } from './edit-event'
import { nextEnabled } from './widget-math'

interface Option {
  id: string
  label: string
  disabled?: boolean | undefined
  reason?: string | undefined
}

interface Props extends BlockedProps {
  label: string
  options: readonly Option[]
  value: string
  onedit?: ((event: EditEvent<string>) => void) | undefined
}

let { label, options, value = $bindable(), onedit, disabled = false, reason, onblocked }: Props = $props()

const uid = $props.id()
let buttons = $state<HTMLElement[]>([])

const isOff = (option: Option): boolean => disabled || option.disabled === true
const reasonOf = (option: Option): string | undefined => (disabled ? reason : option.reason)
const selectedIndex = $derived(options.findIndex((option) => option.id === value))
// The tab stop is the chosen option, or the first enabled one when nothing is chosen.
const stop = $derived(
  selectedIndex >= 0 && !isOff(options[selectedIndex] as Option)
    ? selectedIndex
    : (nextEnabled(options.length, -1, 1, (i) => !isOff(options[i] as Option)) ?? 0),
)

function choose(option: Option): boolean {
  if (isOff(option)) {
    onblocked?.(reasonOf(option))
    return false
  }
  if (option.id !== value) {
    value = option.id
    onedit?.({ value: option.id, phase: 'set' })
  }
  return true
}

async function move(index: number | undefined): Promise<void> {
  const option = index === undefined ? undefined : options[index]
  if (index === undefined || option === undefined || !choose(option)) return
  await tick()
  buttons[index]?.focus()
}

function onKey(event: KeyboardEvent, index: number): void {
  const enabled = (i: number): boolean => !isOff(options[i] as Option)
  let target: number | undefined
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
    target = nextEnabled(options.length, index, 1, enabled)
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    target = nextEnabled(options.length, index, -1, enabled)
  else if (event.key === 'Home') target = nextEnabled(options.length, -1, 1, enabled)
  else if (event.key === 'End') target = nextEnabled(options.length, -1, -1, enabled)
  else return
  event.preventDefault()
  void move(target)
}
</script>

<div class="segmented" role="radiogroup" aria-label={label} data-widget="segmented">
  {#each options as option, index (option.id)}
    <button
      type="button"
      class="option"
      role="radio"
      aria-checked={option.id === value}
      aria-disabled={isOff(option) || undefined}
      aria-describedby={isOff(option) && reasonOf(option) ? `${uid}-reason-${option.id}` : undefined}
      tabindex={index === stop ? 0 : -1}
      title={isOff(option) ? reasonOf(option) : undefined}
      bind:this={buttons[index]}
      onclick={() => choose(option)}
      onkeydown={(event) => onKey(event, index)}
    >
      {option.label}
    </button>
    {#if isOff(option) && reasonOf(option)}
      <span class="reason" id={`${uid}-reason-${option.id}`}>{reasonOf(option)}</span>
    {/if}
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    max-width: 100%;
    padding: 2px;
    gap: 2px;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
  }
  .option {
    flex: 1 1 auto;
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: calc(var(--radius-md) - 2px);
    background: transparent;
    color: var(--color-text-dim);
    font: var(--text-body-13-medium);
    cursor: pointer;
  }
  .option[aria-checked='true'] {
    background: var(--color-accent-soft);
    color: var(--color-text-primary);
  }
  .option[aria-disabled='true'] {
    opacity: 0.45;
  }
  .option:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
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
