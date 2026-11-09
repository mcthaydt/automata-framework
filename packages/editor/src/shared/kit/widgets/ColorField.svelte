<!--
  A colour, palette first. The trigger shows the current colour as a swatch with the word "Change" (the hex is its accessible name and the Custom field); pressing it opens a
  panel with a listbox of palette swatches (arrows move, Enter or a press picks and closes) and a "Custom" button
  that reveals a hex field (`#rrggbb`, refused with a message otherwise) beside the browser's colour input. Picking is a
  `set` edit event; picking the colour it already has emits nothing. Escape closes and returns focus to the trigger.
-->
<script lang="ts">
import { tick } from 'svelte'
import { parseHexColor, sameColor } from './color'
import type { BlockedProps, EditEvent } from './edit-event'
import Swatch from './Swatch.svelte'
import { nextEnabled } from './widget-math'

interface Props extends BlockedProps {
  label: string
  value: string
  palette: readonly string[]
  onedit?: ((event: EditEvent<string>) => void) | undefined
}

let { label, value = $bindable(), palette, onedit, disabled = false, reason, onblocked }: Props = $props()

const uid = $props.id()
const panelId = `${uid}-panel`
const reasonId = `${uid}-reason`
const messageId = `${uid}-message`

let open = $state(false)
let custom = $state(false)
let draft = $state('')
let message = $state<string | undefined>()
let triggerEl = $state<HTMLButtonElement>()
let swatches = $state<(HTMLButtonElement | undefined)[]>([])

const shown = $derived(value.toLowerCase())
const chosen = $derived(palette.findIndex((color) => sameColor(color, value)))

async function openPanel(): Promise<void> {
  open = true
  custom = false
  message = undefined
  await tick()
  swatches[chosen >= 0 ? chosen : 0]?.focus()
}

async function closePanel(refocus: boolean): Promise<void> {
  open = false
  custom = false
  message = undefined
  if (refocus) {
    await tick()
    triggerEl?.focus()
  }
}

function onTrigger(): void {
  if (disabled) {
    onblocked?.(reason)
    return
  }
  if (open) void closePanel(true)
  else void openPanel()
}

function pick(color: string): void {
  if (!sameColor(color, value)) {
    value = color
    onedit?.({ value: color, phase: 'set' })
  }
  void closePanel(true)
}

function onSwatchKey(event: KeyboardEvent, index: number): void {
  const step =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : 0
  if (step === 0) return
  event.preventDefault()
  const target = nextEnabled(palette.length, index, step === 1 ? 1 : -1, () => true)
  if (target !== undefined) swatches[target]?.focus()
}

async function showCustom(): Promise<void> {
  custom = !custom
  draft = value.toLowerCase()
  message = undefined
  if (custom) {
    await tick()
    document.getElementById(`${uid}-hex`)?.focus()
  }
}

function commitDraft(): void {
  const parsed = parseHexColor(draft)
  if (!parsed.ok) {
    message = parsed.message
    return
  }
  pick(parsed.value)
}

function onPanelKey(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !open) return
  event.preventDefault()
  void closePanel(true)
}
</script>

<div class="color-field" data-widget="color-field" data-state={open ? 'open' : disabled ? 'disabled' : 'idle'} onkeydown={onPanelKey} role="presentation">
  <span class="label">{label}</span>
  <button
    type="button"
    class="trigger"
    aria-label={`${label}: ${shown}`}
    aria-expanded={open}
    aria-controls={open ? panelId : undefined}
    aria-disabled={disabled || undefined}
    aria-describedby={disabled && reason ? reasonId : undefined}
    title={disabled ? reason : undefined}
    bind:this={triggerEl}
    onclick={onTrigger}
  >
    <span class="chip" style:background={value}></span>
    <span class="change">Change</span>
  </button>
  {#if disabled && reason}<span class="reason" id={reasonId}>{reason}</span>{/if}
  {#if open}
    <div class="panel" id={panelId}>
      <div class="palette" role="listbox" aria-label={`${label} palette`}>
        {#each palette as color, index (color)}
          <Swatch
            kind="option"
            {color}
            label={color}
            selected={index === chosen}
            tabindex={index === (chosen >= 0 ? chosen : 0) ? 0 : -1}
            bind:button={swatches[index]}
            onpress={() => pick(color)}
            onkeydown={(event) => onSwatchKey(event, index)}
          />
        {/each}
      </div>
      <button type="button" class="custom-toggle" aria-expanded={custom} onclick={showCustom}>Custom</button>
      {#if custom}
        <div class="custom">
          <input
            id={`${uid}-hex`}
            class="hex-field"
            type="text"
            autocomplete="off"
            spellcheck="false"
            aria-label={`${label} custom hex`}
            aria-invalid={message ? 'true' : undefined}
            aria-describedby={message ? messageId : undefined}
            bind:value={draft}
            onkeydown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitDraft()
              }
            }}
          />
          <input
            class="native"
            type="color"
            aria-label={`${label} colour picker`}
            value={value.toLowerCase()}
            onchange={(event) => pick(event.currentTarget.value)}
          />
          {#if message}<span class="message" id={messageId} role="alert">{message}</span>{/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .color-field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
    color: var(--ink);
    font: var(--text-body-13);
  }
  /* `--label-flex`: the label-left column of an inspector (see Stepper). */
  .label {
    flex: var(--label-flex, 1 1 4rem);
    color: var(--muted);
  }
  .trigger,
  .custom-toggle,
  .hex-field,
  .native {
    box-sizing: border-box;
    min-height: var(--size-hit);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: inherit;
    font: var(--text-mono-12);
  }
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    cursor: pointer;
  }
  .change {
    font: var(--text-body-13);
  }
  .chip {
    width: 24px;
    height: 24px;
    border-radius: var(--edge-sm);
    border: 1px solid var(--line-strong);
  }
  .panel {
    flex: 1 1 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--paper);
    box-shadow: var(--shadow-sheet);
  }
  .palette {
    display: flex;
    flex-wrap: wrap;
  }
  .custom-toggle {
    padding: 0 var(--space-3);
    font: var(--text-body-13-medium);
    cursor: pointer;
  }
  .custom {
    flex: 1 1 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .hex-field {
    width: 7rem;
    padding: 0 var(--space-2);
  }
  .native {
    width: var(--size-hit);
    padding: 2px;
    cursor: pointer;
  }
  .hex-field[aria-invalid='true'] {
    border-color: var(--bad);
  }
  .message {
    flex: 1 1 100%;
    color: var(--bad);
    font: var(--text-label-12);
  }
  .color-field[data-state='disabled'] .trigger {
    opacity: 0.55;
  }
  .trigger:focus-visible,
  .custom-toggle:focus-visible,
  .hex-field:focus-visible,
  .native:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
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
