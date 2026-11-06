<!--
  @component
  The rotate toast (the Owner asked for a toast, not a gate): for a
  game with `rotateHint: 'toast'`, a small message at the top on a phone held the other way, "Turn your phone for a
  bigger view", with an OK. It covers nothing and pauses nothing; the only part a thumb can hit is the OK, at 44 px.
-->
<script lang="ts">
import type { RotateToastCopy } from './display-copy'

interface Props {
  shown: boolean
  copy: RotateToastCopy
  ondismiss: () => void
}

const { shown, copy, ondismiss }: Props = $props()
</script>

{#if shown}
  <div class="af-rotate-toast" data-testid="rotate-toast" role="note">
    <span class="af-rotate-toast__icon" aria-hidden="true">⟳</span>
    <span>{copy.text}</span>
    <button type="button" class="af-control af-control--ghost af-rotate-toast__ok" aria-label={copy.dismiss} onclick={ondismiss}
      >{copy.ok}</button
    >
  </div>
{/if}

<style>
  /* At the top, inside the safe area and the host's strip, over the game but never over the middle of it. */
  .af-rotate-toast {
    position: fixed;
    top: max(8px, var(--af-inset-top, 0px));
    left: 50%;
    z-index: 150;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100% - 2 * var(--af-gutter));
    padding: 0 4px 0 12px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: var(--af-radius);
    background: var(--af-panel);
    color: var(--af-ink);
    font: var(--af-text-small) / 1.3 var(--af-font);
  }

  .af-rotate-toast__icon {
    font-size: calc(var(--af-text-small) * 1.2);
  }

  .af-rotate-toast__ok {
    flex: none;
  }
</style>
