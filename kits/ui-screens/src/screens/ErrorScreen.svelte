<!--
  @component
  The error screen (PRODUCT.6): the game's title on core's ScreenFrame with core's ErrorPanel. Every failure names a way forward: an
  action, or, when the device cannot run the game at all (`final`), the frame's Back, so a final failure needs `onBack`. The primary
  action takes focus on entry; Escape goes back when the game gives a way back. The panel's own layout rules (where the message
  scrolls, where the actions stack) are core's.
-->
<script lang="ts">
import { type ErrorAction, ErrorPanel, ScreenFrame } from '@mcthaydt/automata-ui'
import { onMount } from 'svelte'

interface Props {
  title: string
  /** A stable code for tests and telemetry. */
  code: string
  message: string
  actions: readonly ErrorAction[]
  /** The failure has no way forward but back (the device cannot run the game). */
  final?: boolean | undefined
  onBack?: (() => void) | undefined
  /** The Back control's name, in the player's language. */
  backLabel?: string | undefined
}

const { title, code, message, actions, final = false, onBack, backLabel }: Props = $props()

$effect.pre(() => {
  if (final && onBack === undefined)
    throw new Error('A final ErrorScreen needs onBack: Back is its only way out')
})

let root = $state<HTMLElement | undefined>(undefined)
onMount(() => {
  root?.querySelector<HTMLElement>('[data-testid="error-panel"] button')?.focus()
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && onBack !== undefined) onBack()
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
})
</script>

{#snippet body()}
  <div class="error__body">
    <h1 class="error__title">{title}</h1>
  </div>
{/snippet}

<div bind:this={root} class="error" data-game-screen="error">
  <ScreenFrame arrangement="stack" testId="error-screen" back={onBack} {backLabel} {body} />
  <ErrorPanel {code} {message} {actions} {final} />
</div>

<style>
  .error__body {
    display: grid;
    justify-items: center;
    min-width: 0;
  }
  .error__title {
    margin: 0;
    font: 700 calc(24px * var(--af-scale, 1)) / 1.2 var(--af-font);
    text-align: center;
  }
</style>
