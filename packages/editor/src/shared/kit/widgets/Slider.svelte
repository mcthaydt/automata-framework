<!--
  A number on a track. The track is at least 44 px high; dragging anywhere on it moves the value to
  the pointer, snapped to `step` and clamped to the range. A single tap changes nothing; a double tap resets to
  `defaultValue`. Arrows step, the Page keys move a tenth of the range, Home and End go to the ends.

  Changes are edit events (edit-event.ts): `set` for a key or a reset, `start` / `update` / `commit` / `cancel` around
  a drag. A disabled slider stays focusable, announces its `reason` and calls `onblocked` when pressed.
-->
<script lang="ts">
import { attachGestures } from '../gestures/attach-gestures'
import type { DragEndGesture, DragGesture, DragStartGesture } from '../gestures/gesture-events'
import type { BlockedProps, EditEvent } from './edit-event'
import { clamp, decimalsOf, roundTo } from './widget-math'

interface Props extends BlockedProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** A double tap resets to this. */
  defaultValue?: number | undefined
  unit?: string | undefined
  onedit?: ((event: EditEvent<number>) => void) | undefined
}

let {
  label,
  value = $bindable(),
  min,
  max,
  step = 1,
  defaultValue,
  unit,
  onedit,
  disabled = false,
  reason,
  onblocked,
}: Props = $props()

const uid = $props.id()
const labelId = `${uid}-label`
const reasonId = `${uid}-reason`

let trackEl = $state<HTMLElement>()
let drag = $state<{ start: number } | undefined>()

const fraction = $derived(max > min ? (clamp(value, min, max) - min) / (max - min) : 0)
const valueText = $derived(unit ? `${value} ${unit}` : String(value))

const emit = (event: EditEvent<number>): void => onedit?.(event)

function blocked(): boolean {
  if (!disabled) return false
  onblocked?.(reason)
  return true
}

/** The nearest step from `min` to a value, rounded to the decimals of the step and the range, inside the range. */
function snap(raw: number): number {
  const decimals = Math.max(decimalsOf(step), decimalsOf(min))
  return clamp(roundTo(min + Math.round((raw - min) / step) * step, decimals), min, max)
}

function setTo(next: number): void {
  if (next === value) return
  value = next
  emit({ value: next, phase: 'set' })
}

function onKey(event: KeyboardEvent): void {
  const tenth = Math.max(step, snap(min + (max - min) / 10) - min)
  const moves: Record<string, number> = {
    ArrowRight: step,
    ArrowUp: step,
    ArrowLeft: -step,
    ArrowDown: -step,
    PageUp: tenth,
    PageDown: -tenth,
  }
  const move = moves[event.key]
  let next: number
  if (move !== undefined)
    next = clamp(roundTo(value + move, Math.max(decimalsOf(step), decimalsOf(value))), min, max)
  else if (event.key === 'Home') next = min
  else if (event.key === 'End') next = max
  else return
  event.preventDefault()
  if (blocked()) return
  setTo(next)
}

function valueAt(x: number): number {
  const width = trackEl?.getBoundingClientRect().width ?? 0
  return width > 0 ? snap(min + clamp(x / width, 0, 1) * (max - min)) : value
}

function follow(event: DragGesture): void {
  if (!drag) return
  const next = valueAt(event.x)
  if (next === value) return
  value = next
  emit({ value: next, phase: 'update' })
}

function onDragStart(event: DragStartGesture): void {
  if (blocked()) return
  drag = { start: value }
  emit({ value, phase: 'start' })
  follow(event)
}

function onDragEnd(event: DragEndGesture): void {
  const current = drag
  if (!current) return
  if (event.cancelled) {
    drag = undefined
    value = current.start
    emit({ value: current.start, phase: 'cancel' })
    return
  }
  follow(event)
  drag = undefined
  emit({ value, phase: value === current.start ? 'cancel' : 'commit' })
}

function onDoubleTap(): void {
  if (blocked() || defaultValue === undefined) return
  setTo(defaultValue)
}

$effect(() => {
  if (!trackEl) return
  return attachGestures(trackEl, {
    dragStart: onDragStart,
    drag: follow,
    dragEnd: onDragEnd,
    doubleTap: onDoubleTap,
  })
})
</script>

<div class="slider" data-widget="slider" data-state={drag ? 'dragging' : disabled ? 'disabled' : 'idle'} title={disabled ? reason : undefined}>
  <span class="label" id={labelId}>{label}</span>
  <div
    class="track"
    role="slider"
    tabindex="0"
    aria-labelledby={labelId}
    aria-valuenow={value}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuetext={valueText}
    aria-disabled={disabled || undefined}
    aria-describedby={disabled && reason ? reasonId : undefined}
    bind:this={trackEl}
    onkeydown={onKey}
  >
    <div class="rail">
      <div class="fill" style:width={`${fraction * 100}%`}></div>
    </div>
    <div class="thumb" style:left={`${fraction * 100}%`}></div>
  </div>
  <output class="readout">{value}{#if unit}<span class="unit">{unit}</span>{/if}</output>
  {#if disabled && reason}<span class="reason" id={reasonId}>{reason}</span>{/if}
</div>

<style>
  .slider {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
    min-height: var(--size-hit);
    color: var(--ink);
    font: var(--text-body-13);
  }
  .label {
    flex: 1 1 100%;
    color: var(--muted);
  }
  .track {
    position: relative;
    flex: 1 1 8rem;
    min-width: 0;
    min-height: var(--size-hit);
    display: flex;
    align-items: center;
    cursor: pointer;
    border-radius: var(--radius-md);
    user-select: none;
  }
  .rail {
    width: 100%;
    height: 6px;
    border-radius: var(--pill);
    background: var(--paper);
    border: 1px solid var(--line);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--cobalt);
  }
  .thumb {
    position: absolute;
    top: 50%;
    width: 24px;
    height: 24px;
    margin: -12px 0 0 -12px;
    border-radius: 50%;
    background: var(--paper);
    box-shadow: var(--shadow);
    border: 2px solid var(--cobalt);
    pointer-events: none;
  }
  .slider[data-state='dragging'] .thumb {
    background: var(--cobalt);
  }
  .track:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .readout {
    flex: none;
    min-width: 3.5rem;
    text-align: right;
    font: var(--text-mono-12);
    font-variant-numeric: tabular-nums;
  }
  .unit {
    margin-left: 2px;
    color: var(--muted);
  }
  .slider[data-state='disabled'] {
    opacity: 0.55;
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
