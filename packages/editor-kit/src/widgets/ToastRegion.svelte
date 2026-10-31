<!--
  Draws a toast store (kit spec §4.6): a polite live region that is in the page before the first toast, so a screen
  reader hears the ones that arrive. It never takes focus. Each toast has its message, an optional action and a
  dismiss button, both 44 px. It sits above the safe area at the foot of the screen, centred, and lets presses through
  everywhere but on a toast. In an `EditorShell`'s `sheets` it sits above the shell's foot (`--shell-foot`).
-->
<script lang="ts">
import type { Toast, ToastStore } from './toasts'

interface Props {
  toasts: ToastStore
}

const { toasts }: Props = $props()

let items = $state.raw<readonly Toast[]>([])
$effect(() => toasts.subscribe((next) => (items = next)))
</script>

<div class="region" role="status" aria-live="polite" data-widget="toast-region">
  {#each items as toast (toast.id)}
    <div class="toast" data-kind={toast.kind}>
      <span class="message">{toast.message}</span>
      {#if toast.action}
        <button type="button" class="action" onclick={() => toasts.activate(toast.id)}>
          {toast.action.label}
        </button>
      {/if}
      <button type="button" class="dismiss" aria-label="Dismiss" onclick={() => toasts.dismiss(toast.id)}>
        ×
      </button>
    </div>
  {/each}
</div>

<style>
  .region {
    position: fixed;
    right: max(var(--space-4), env(safe-area-inset-right, 0px));
    /* Inside a shell's sheets, above its foot (the tab bar and the status line); elsewhere at the window's foot. */
    bottom: calc(max(var(--space-4), env(safe-area-inset-bottom, 0px)) + var(--shell-foot, 0px));
    left: max(var(--space-4), env(safe-area-inset-left, 0px));
    z-index: 110;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    max-width: min(32rem, 100%);
    padding-left: var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-left: 3px solid var(--color-accent-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    pointer-events: auto;
  }
  .toast[data-kind='ok'] {
    border-left-color: var(--color-state-ok);
  }
  .toast[data-kind='warn'] {
    border-left-color: var(--color-state-warn);
  }
  .toast[data-kind='error'] {
    border-left-color: var(--color-state-bad);
  }
  .message {
    min-width: 0;
    padding: var(--space-3) 0;
    overflow-wrap: anywhere;
  }
  .action,
  .dismiss {
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .action {
    color: var(--color-accent-default);
    font: var(--text-body-13-medium);
  }
  .dismiss {
    color: var(--color-text-dim);
    font-size: 18px;
  }
  .action:focus-visible,
  .dismiss:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: -2px;
  }
</style>
