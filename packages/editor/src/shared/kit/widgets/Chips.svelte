<!--
  A row of toggles: `multi` lets any number be on, `single` keeps exactly one chosen. A chip with
  `removable` has its own 44 px remove button, which calls `onremove` and never changes the selection. A disabled
  chip stays focusable, announces its reason and calls `onblocked` when pressed. A change is a `set` edit event
  carrying the whole selection in the order of `items`.
-->
<script lang="ts">
import type { BlockedProps, EditEvent } from './edit-event'

interface Chip {
  id: string
  label: string
  removable?: boolean | undefined
  disabled?: boolean | undefined
  reason?: string | undefined
}

interface Props extends BlockedProps {
  label: string
  items: readonly Chip[]
  selected: readonly string[]
  mode?: 'single' | 'multi'
  onedit?: ((event: EditEvent<readonly string[]>) => void) | undefined
  onremove?: ((id: string) => void) | undefined
}

let {
  label,
  items,
  selected = $bindable(),
  mode = 'multi',
  onedit,
  onremove,
  disabled = false,
  reason,
  onblocked,
}: Props = $props()

const uid = $props.id()
const isOff = (chip: Chip): boolean => disabled || chip.disabled === true
const reasonOf = (chip: Chip): string | undefined => (disabled ? reason : chip.reason)

function toggle(chip: Chip): void {
  if (isOff(chip)) {
    onblocked?.(reasonOf(chip))
    return
  }
  const on = selected.includes(chip.id)
  if (mode === 'single' && on) return
  const wanted =
    mode === 'single'
      ? new Set([chip.id])
      : new Set(on ? selected.filter((id) => id !== chip.id) : [...selected, chip.id])
  const next = items.filter((item) => wanted.has(item.id)).map((item) => item.id)
  selected = next
  onedit?.({ value: next, phase: 'set' })
}
</script>

<div class="chips" role="group" aria-label={label} data-widget="chips">
  {#each items as chip (chip.id)}
    <span class="chip" data-removable={chip.removable || undefined}>
      <button
        type="button"
        class="body"
        aria-pressed={selected.includes(chip.id)}
        aria-disabled={isOff(chip) || undefined}
        aria-describedby={isOff(chip) && reasonOf(chip) ? `${uid}-reason-${chip.id}` : undefined}
        title={isOff(chip) ? reasonOf(chip) : undefined}
        onclick={() => toggle(chip)}>{chip.label}</button
      >
      {#if chip.removable}
        <button type="button" class="remove" aria-label={`Remove ${chip.label}`} onclick={() => onremove?.(chip.id)}>×</button>
      {/if}
      {#if isOff(chip) && reasonOf(chip)}
        <span class="reason" id={`${uid}-reason-${chip.id}`}>{reasonOf(chip)}</span>
      {/if}
    </span>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .chip {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    overflow: hidden;
  }
  .body,
  .remove {
    min-height: var(--size-hit);
    border: 0;
    background: transparent;
    color: var(--muted);
    font: var(--text-body-13-medium);
    cursor: pointer;
  }
  .body {
    padding: 0 var(--space-4);
  }
  .remove {
    min-width: var(--size-hit);
    padding: 0;
    font-size: 18px;
  }
  .chip:has(.body[aria-pressed='true']) {
    border-color: var(--cobalt);
    background: var(--cobalt-soft);
  }
  .body[aria-pressed='true'] {
    color: var(--cobalt);
  }
  .body[aria-disabled='true'] {
    opacity: 0.45;
  }
  .body:focus-visible,
  .remove:focus-visible {
    outline: 2px solid var(--focus);
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
