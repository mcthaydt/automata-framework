<!--
  @component
  The keypad: ten digits (48 px), Delete, Enter and Close, for a code of `digits` digits. Enter works once the code is
  whole and sends it; Escape, Close and a pad's B close the keypad. Typing digits, Backspace and Enter on a keyboard
  works as well. It exists only while it is open, so a cutscene that takes the input closes it and it opens empty.
-->
<script lang="ts">
import { onMount } from 'svelte'
import { padSteer } from '../../shared/pad'
import { canEnter, deleteDigit, display, typeDigit } from './keypad'

interface Props {
  digits: number
  words: { readonly delete: string; readonly enter: string; readonly close: string }
  style: string
  oncode: (code: string) => void
  ondismiss: () => void
}
const { digits, words, style, oncode, ondismiss }: Props = $props()

let code = $state('')
let root: HTMLElement | undefined = $state()
// The focus starts on the first digit, so a keyboard or a pad can begin at once.
onMount(() => root?.querySelector('button')?.focus({ preventScroll: true }))

const enter = (): void => {
  if (canEnter(code, digits)) oncode(code)
}
function onkeydown(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key === 'Escape') ondismiss()
  else if (event.key === 'Backspace') code = deleteDigit(code)
  else if (event.key === 'Enter') {
    // Enter on a focused button presses that button; only an Enter for nothing in particular sends the code.
    if (event.target instanceof Element && event.target.closest('button') !== null) return
    enter()
  } else if (/^[0-9]$/.test(event.key)) code = typeDigit(code, event.key, digits)
  else return
  event.preventDefault()
}
</script>

<svelte:window {onkeydown} />

<div class="hud-keypad" role="dialog" aria-label={words.enter} data-testid="hud-keypad" {style} bind:this={root} use:padSteer={{ onback: ondismiss }}>
  <p class="code" data-testid="hud-keypad-code" aria-live="polite">{display(code, digits)}</p>
  <div class="pad">
    {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as digit (digit)}
      <button
        type="button"
        class="af-control key"
        data-testid={`hud-key-${digit}`}
        onclick={() => (code = typeDigit(code, digit, digits))}>{digit}</button
      >
    {/each}
    <button type="button" class="af-control key" data-testid="hud-key-delete" onclick={() => (code = deleteDigit(code))}
      >{words.delete}</button
    >
    <button type="button" class="af-control key" data-testid="hud-key-0" onclick={() => (code = typeDigit(code, '0', digits))}>0</button>
    <button
      type="button"
      class="af-control af-control--primary key"
      data-kind="primary"
      data-testid="hud-key-enter"
      disabled={!canEnter(code, digits)}
      onclick={enter}>{words.enter}</button
    >
  </div>
  <button type="button" class="af-control close" data-testid="hud-key-close" onclick={ondismiss}>{words.close}</button>
</div>

<style>
  .hud-keypad {
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    max-height: 100%;
    overflow-y: auto;
    padding: 12px;
    border: var(--af-edge-width, 2px) solid var(--af-edge, #a6aeba);
    border-radius: var(--af-radius, 6px);
    background: var(--af-surface, #181f2f);
    color: var(--af-ink, #f5f7fa);
    font: var(--af-text-body, 16px) / 1.4 var(--af-font, system-ui, sans-serif);
    pointer-events: auto;
  }
  .code {
    margin: 0;
    font-size: 1.75rem;
    letter-spacing: 0.4em;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .pad {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .key {
    min-height: var(--af-target-primary, 48px);
    overflow-wrap: anywhere;
  }
  .close {
    min-height: var(--af-target, 44px);
  }
</style>
