<!--
  @component
  The prompt: a 48 px button naming the hotspot within reach. Pressing it uses the hotspot; so does Enter (unless the
  key is for another control) and a pad's confirm (A), once for each press. It exists only while there is something to
  use, so nothing listens the rest of the time.
-->
<script lang="ts">
import { onMount } from 'svelte'

interface Props {
  /** The hotspot's name, already looked up. */
  name: string
  /** The verb word ("Use"), when the file gives one. */
  label?: string | undefined
  /** Where the file puts it (`placeStyle`). */
  style: string
  onuse: () => void
}
const { name, label, style, onuse }: Props = $props()

/** A control that takes Enter itself. */
const TAKES_ENTER = 'button, a, input, textarea, select, summary, [contenteditable], [role=button]'

onMount(() => {
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.target instanceof Element && event.target.closest(TAKES_ENTER) !== null) return
    event.preventDefault()
    onuse()
  }
  window.addEventListener('keydown', onKey)
  // A pad's A, once per press. A button already held when the prompt appears is not a press.
  const pressed = (): boolean =>
    (navigator.getGamepads?.() ?? []).some((pad) => pad?.buttons[0]?.pressed === true)
  let held = pressed()
  let frame = 0
  const poll = (): void => {
    const now = pressed()
    if (now && !held) onuse()
    held = now
    frame = requestAnimationFrame(poll)
  }
  frame = requestAnimationFrame(poll)
  return () => {
    window.removeEventListener('keydown', onKey)
    cancelAnimationFrame(frame)
  }
})
</script>

<button
  type="button"
  class="af-control af-control--primary hud-prompt"
  data-kind="primary"
  data-testid="hud-prompt"
  {style}
  onclick={onuse}
>
  {#if label !== undefined}<span class="verb">{label}</span>{/if}
  <span class="name">{name}</span>
</button>

<style>
  .hud-prompt {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-height: var(--af-target-primary, 48px);
    padding-inline: 16px;
    overflow-wrap: anywhere;
    text-align: center;
    pointer-events: auto;
  }
  .verb {
    color: var(--af-accent, #ffcf05);
    font-weight: 700;
  }
</style>
