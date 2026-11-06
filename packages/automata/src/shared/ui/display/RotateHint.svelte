<!--
  @component
  The rotate hint: over a game locked to one orientation (`GameSpec.orientation`) on a phone held
  the other way. The runtime pauses the game while it shows (`Time.pause('display')`). Not interactive: turning the
  phone is the only way past it, so nothing in it takes focus. The words follow FloorFifty `RotateHint.svelte` at
  `ac72660`, which offers the same advice as a toast.
-->
<script lang="ts">
import { inertOutside } from '../dialog/modal-scope'
import type { RotateHintCopy } from './display-copy'

interface Props {
  shown: boolean
  copy: RotateHintCopy
}

const { shown, copy }: Props = $props()

// The paused game behind it is out of reach while it shows, as behind a modal; the hint itself takes no focus.
// `bind:this` sets null when the hint goes. A browser drops the focus from a control made inert, so the control that
// held it gets it back when the hint goes, unless the focus has moved on meanwhile or the control has gone (G3-x).
let root = $state<HTMLElement | null | undefined>(undefined)
$effect(() => {
  if (root == null) return undefined
  const focused = document.activeElement
  const release = inertOutside(root)
  return () => {
    release()
    const moved = document.activeElement !== null && document.activeElement !== document.body
    if (!moved && focused instanceof HTMLElement && focused !== document.body && focused.isConnected)
      focused.focus()
  }
})
</script>

{#if shown}
  <div bind:this={root} class="af-rotate-hint" data-testid="rotate-hint" role="status">
    <!-- On a panel, as the landscape gate's: the scrim alone lets the paused screen's words show through. -->
    <div class="af-rotate-hint__panel">
      <span class="af-rotate-hint__icon" aria-hidden="true">⟳</span>
      <p class="af-rotate-hint__title">{copy.title}</p>
      <p class="af-rotate-hint__body">{copy.body}</p>
    </div>
  </div>
{/if}

<style>
  .af-rotate-hint {
    position: fixed;
    inset: 0 0 var(--af-visual-inset-bottom, 0px);
    z-index: 190;
    box-sizing: border-box;
    display: grid;
    place-items: center;
    padding: max(var(--af-gutter), var(--af-inset-top, 0px)) max(var(--af-gutter), var(--af-inset-right, 0px))
      max(var(--af-gutter), var(--af-inset-bottom, 0px)) max(var(--af-gutter), var(--af-inset-left, 0px));
    background: var(--af-scrim);
  }

  .af-rotate-hint__panel {
    box-sizing: border-box;
    display: grid;
    justify-items: center;
    gap: 8px;
    max-width: 26rem;
    max-height: 100%;
    overflow-y: auto;
    padding: 20px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: var(--af-radius);
    background: var(--af-panel);
    color: var(--af-ink);
    text-align: center;
    font: var(--af-text-body) / 1.4 var(--af-font);
  }

  .af-rotate-hint__icon {
    font-size: 2rem;
    line-height: 1;
  }

  .af-rotate-hint__title {
    margin: 0;
    font-weight: 700;
  }

  .af-rotate-hint__body {
    margin: 0;
  }
</style>
