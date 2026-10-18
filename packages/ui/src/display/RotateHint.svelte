<!--
  @component
  The rotate hint (M4 spec §4.9, §7): over a game locked to one orientation (`GameSpec.orientation`) on a phone held
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
// `bind:this` sets null when the hint goes.
let root = $state<HTMLElement | null | undefined>(undefined)
$effect(() => (root == null ? undefined : inertOutside(root)))
</script>

{#if shown}
  <div bind:this={root} class="af-rotate-hint" data-testid="rotate-hint" role="status">
    <span class="af-rotate-hint__icon" aria-hidden="true">⟳</span>
    <p class="af-rotate-hint__title">{copy.title}</p>
    <p class="af-rotate-hint__body">{copy.body}</p>
  </div>
{/if}

<style>
  .af-rotate-hint {
    position: fixed;
    inset: 0 0 var(--af-visual-inset-bottom, 0px);
    z-index: 190;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: max(var(--af-gutter), var(--af-inset-top, 0px)) max(var(--af-gutter), var(--af-inset-right, 0px))
      max(var(--af-gutter), var(--af-inset-bottom, 0px)) max(var(--af-gutter), var(--af-inset-left, 0px));
    background: var(--af-scrim);
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
