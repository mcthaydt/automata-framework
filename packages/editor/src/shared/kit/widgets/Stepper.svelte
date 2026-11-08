<!--
  A number with a drag-to-scrub label.

    label     drag left or right to scrub: one `step` for every `pixelsPerStep` pixels from where the press began
    - / +     step buttons, 44 px each
    value     a spinbutton: arrows step, Page keys move ten steps, Home and End go to the bounds; pressing it (or
              Enter, or F2) opens a text field

  Changes are reported as edit events (edit-event.ts): `set` for a button, a key or a typed value, and
  `start` / `update` / `commit` / `cancel` around a drag, so the editor can make one drag one undo step. Scrubbing and
  stepping clamp to `min` and `max` and show a stop (`data-at-limit`); typing is refused with a message when it is not
  a number, is out of bounds, is not whole where `integer` is set, or when `validate` says no. The value then keeps
  its previous number.

  A disabled stepper stays focusable and announces its `reason`; pressing it calls `onblocked`.
-->
<script lang="ts">
import { tick } from 'svelte'
import { attachGestures } from '../gestures/attach-gestures'
import type { DragEndGesture, DragGesture, DragStartGesture } from '../gestures/gesture-events'
import type { BlockedProps, EditEvent } from './edit-event'
import { parseNumberText, scrubbedValue, steppedValue } from './stepper-model'

interface Props extends BlockedProps {
  label: string
  value: number
  min?: number | undefined
  max?: number | undefined
  step?: number
  unit?: string | undefined
  /** Only whole numbers may be typed. */
  integer?: boolean
  pixelsPerStep?: number
  /** Returns a message to refuse a typed value, or nothing to accept it. */
  validate?: ((value: number) => string | undefined) | undefined
  /** A problem the editor knows about (a clash with another field); shown like a refused edit. */
  error?: string | undefined
  onedit?: ((event: EditEvent<number>) => void) | undefined
}

let {
  label,
  value = $bindable(),
  min,
  max,
  step = 1,
  unit,
  integer = false,
  pixelsPerStep = 4,
  validate,
  error,
  onedit,
  disabled = false,
  reason,
  onblocked,
}: Props = $props()

const uid = $props.id()
const labelId = `${uid}-label`
const reasonId = `${uid}-reason`
const messageId = `${uid}-message`

let scrub = $state<{ start: number } | undefined>()
let typing = $state(false)
let draft = $state('')
let message = $state<string | undefined>()
let labelEl = $state<HTMLElement>()
let spinEl = $state<HTMLElement>()
let fieldEl = $state<HTMLInputElement>()

const shown = $derived(message ?? error)
const status = $derived(
  scrub ? 'scrubbing' : typing ? 'typing' : shown ? 'invalid' : disabled ? 'disabled' : 'idle',
)
const atLimit = $derived(
  max !== undefined && value >= max ? 'max' : min !== undefined && value <= min ? 'min' : undefined,
)
const valueText = $derived(unit ? `${value} ${unit}` : String(value))

const emit = (event: EditEvent<number>): void => onedit?.(event)

function blocked(): boolean {
  if (!disabled) return false
  onblocked?.(reason)
  return true
}

/** `steps` whole steps from the current value; nothing happens at a bound. */
function nudge(steps: number): void {
  if (blocked()) return
  message = undefined
  const next = steppedValue(value, steps, { step, min, max })
  if (next === value) return
  value = next
  emit({ value: next, phase: 'set' })
}

function jumpTo(bound: number | undefined): void {
  if (blocked() || bound === undefined) return
  message = undefined
  if (bound === value) return
  value = bound
  emit({ value: bound, phase: 'set' })
}

function beginTyping(): void {
  if (blocked()) return
  message = undefined
  draft = String(value)
  typing = true
}

async function finishTyping(commit: boolean, refocus: boolean): Promise<void> {
  if (!typing) return
  typing = false
  if (commit) {
    const parsed = parseNumberText(draft, { min, max, integer })
    const refusal = parsed.ok ? validate?.(parsed.value) : parsed.message
    if (refusal !== undefined) message = refusal
    else if (parsed.ok && parsed.value !== value) {
      value = parsed.value
      emit({ value: parsed.value, phase: 'set' })
    }
  }
  if (refocus) {
    await tick()
    spinEl?.focus()
  }
}

$effect(() => {
  if (typing && fieldEl) {
    fieldEl.focus()
    fieldEl.select()
  }
})

function onSpinKey(event: KeyboardEvent): void {
  const steps: Record<string, number> = {
    ArrowUp: 1,
    ArrowRight: 1,
    ArrowDown: -1,
    ArrowLeft: -1,
    PageUp: 10,
    PageDown: -10,
  }
  const named = steps[event.key]
  if (named !== undefined) nudge(named)
  else if (event.key === 'Home') jumpTo(min)
  else if (event.key === 'End') jumpTo(max)
  else if (event.key === 'Enter' || event.key === 'F2') beginTyping()
  else return
  event.preventDefault()
}

function onFieldKey(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    void finishTyping(true, true)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    void finishTyping(false, true)
  }
}

function scrubTo(event: DragGesture): void {
  if (!scrub) return
  const next = scrubbedValue(scrub.start, event.x - event.startX, { step, pixelsPerStep, min, max })
  if (next === value) return
  value = next
  emit({ value: next, phase: 'update' })
}

function onDragStart(event: DragStartGesture): void {
  if (blocked()) return
  message = undefined
  scrub = { start: value }
  emit({ value, phase: 'start' })
  scrubTo(event)
}

function onDragEnd(event: DragEndGesture): void {
  const current = scrub
  if (!current) return
  if (event.cancelled) {
    scrub = undefined
    value = current.start
    emit({ value: current.start, phase: 'cancel' })
    return
  }
  scrubTo(event)
  scrub = undefined
  emit({ value, phase: value === current.start ? 'cancel' : 'commit' })
}

$effect(() => {
  if (!labelEl) return
  return attachGestures(labelEl, { dragStart: onDragStart, drag: scrubTo, dragEnd: onDragEnd })
})
</script>

<div
  class="stepper"
  role="group"
  aria-labelledby={labelId}
  data-widget="stepper"
  data-state={status}
  data-at-limit={atLimit}
  title={disabled ? reason : undefined}
>
  <span class="label" id={labelId} data-scrub-handle bind:this={labelEl}>{label}</span>
  <button
    type="button"
    class="step"
    aria-label={`Decrease ${label}`}
    aria-disabled={disabled || undefined}
    onclick={() => nudge(-1)}>−</button
  >
  {#if typing}
    <input
      class="field"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      spellcheck="false"
      aria-label={label}
      bind:this={fieldEl}
      bind:value={draft}
      onkeydown={onFieldKey}
      onblur={() => void finishTyping(true, false)}
    />
  {:else}
    <div
      class="value"
      role="spinbutton"
      tabindex="0"
      aria-labelledby={labelId}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={valueText}
      aria-invalid={shown ? 'true' : undefined}
      aria-disabled={disabled || undefined}
      aria-describedby={[disabled && reason ? reasonId : undefined, shown ? messageId : undefined].filter(Boolean).join(' ') || undefined}
      bind:this={spinEl}
      onkeydown={onSpinKey}
      onclick={beginTyping}
    >
      {value}{#if unit}<span class="unit">{unit}</span>{/if}
    </div>
  {/if}
  <button
    type="button"
    class="step"
    aria-label={`Increase ${label}`}
    aria-disabled={disabled || undefined}
    onclick={() => nudge(1)}>+</button
  >
  {#if shown}<span class="message" id={messageId} role="alert">{shown}</span>{/if}
  {#if disabled && reason}<span class="reason" id={reasonId}>{reason}</span>{/if}
</div>

<style>
  .stepper {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--size-hit);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .label {
    flex: 1 1 4rem;
    min-width: 0;
    min-height: var(--size-hit);
    display: flex;
    align-items: center;
    color: var(--color-text-dim);
    cursor: ew-resize;
    user-select: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stepper[data-state='scrubbing'] .label {
    color: var(--color-accent-default);
  }
  .step,
  .value,
  .field {
    box-sizing: border-box;
    min-height: var(--size-hit);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: inherit;
    font: var(--text-mono-12);
  }
  .step {
    flex: none;
    width: var(--size-hit);
    padding: 0;
    cursor: pointer;
    font-size: 18px;
  }
  .value,
  .field {
    flex: none;
    width: 5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    padding: 0 var(--space-2);
    text-align: center;
    font-variant-numeric: tabular-nums;
    cursor: text;
  }
  .unit {
    color: var(--color-text-faint);
  }
  .stepper[data-state='invalid'] .value,
  .stepper[data-state='invalid'] .field {
    border-color: var(--color-state-bad);
  }
  /* The stop: the button that would go past a bound dims. */
  .stepper[data-at-limit='max'] .step:last-of-type,
  .stepper[data-at-limit='min'] .step:first-of-type {
    opacity: 0.4;
  }
  .stepper[data-state='disabled'] {
    opacity: 0.55;
  }
  .step:focus-visible,
  .value:focus-visible,
  .field:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 1px;
  }
  .message {
    flex: 1 1 100%;
    color: var(--color-state-bad);
    font: var(--text-label-12);
  }
  /* The reason is for assistive technology and the tooltip; the dimmed look is the visible cue. */
  .reason {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
