<!--
  @component
  The examine box: a line said about something, in narrative's one box (the same look as a conversation, and the typed-out
  delivery lands there for both). Any press dismisses it: a press on the box, its button, Enter, Space, Escape or a pad's
  confirm. It is the one piece that stays while a cutscene holds input.
-->
<script lang="ts">
import { LineBox } from '@automataframework/narrative'
import { onMount } from 'svelte'
import { padSteer } from '../../shared/pad'

interface Props {
  title: string | undefined
  line: string
  close: string
  style: string
  ondismiss: () => void
}
const { title, line, close, style, ondismiss }: Props = $props()

/** A control that takes Enter and Space itself. */
const TAKES_KEYS = 'button, a, input, textarea, select, summary, [contenteditable], [role=button]'

let root: HTMLElement | undefined = $state()
// The focus starts on the button, so Enter, Space and a pad's A all dismiss it.
onMount(() => root?.querySelector('button')?.focus({ preventScroll: true }))

function onkeydown(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return
  if (event.key === 'Escape') ondismiss()
  else if (event.key === 'Enter' || event.key === ' ') {
    if (event.target instanceof Element && event.target.closest(TAKES_KEYS) !== null) return
    event.preventDefault()
    ondismiss()
  }
}
</script>

<svelte:window {onkeydown} />

<!-- A press anywhere on the box dismisses it; the button is the same press for a keyboard or a pad. -->
<div role="presentation" class="hud-examine" {style} bind:this={root} onclick={ondismiss} use:padSteer={{ onback: ondismiss }}>
  <LineBox speaker={title} text={line} placed style="position: static;">
    <button
      type="button"
      class="af-control af-control--primary"
      data-kind="primary"
      data-testid="hud-examine-close"
      onclick={(event) => {
        event.stopPropagation()
        ondismiss()
      }}>{close}</button
    >
  </LineBox>
</div>

<style>
  .hud-examine {
    pointer-events: auto;
  }
  button {
    justify-self: end;
    min-width: 8rem;
    min-height: var(--af-target-primary, 48px);
  }
</style>
