<!--
  A modal dialog over a scrim (kit spec §4.6). It is not a native `<dialog>`: it owns its focus, which is what the
  editor needs on a tablet and what jsdom can test. Opening remembers the focused element and moves focus to the
  first `[data-autofocus]`, else the first tabbable element, else the dialog; Tab and Shift+Tab stay inside;
  Escape and a press on the scrim close it (unless `dismissible` is false), and closing, however it happens,
  puts focus back where it was. `actions` gets `close`, which closes with the reason `action`.

  A press counts as a scrim press only when it started and ended on the scrim, so selecting text and letting go
  outside the dialog does not close it, and the click is never handed to the page underneath.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import { initialFocusIn, trapTab } from './focus-trap'

type CloseReason = 'escape' | 'scrim' | 'action'

interface Props {
  open: boolean
  title: string
  dismissible?: boolean
  onclose?: ((why: CloseReason) => void) | undefined
  children: Snippet
  actions?: Snippet<[{ close: () => void }]> | undefined
}

let { open = $bindable(), title, dismissible = true, onclose, children, actions }: Props = $props()

const uid = $props.id()
let dialog = $state<HTMLElement>()
let pressedScrim = false

function close(why: CloseReason): void {
  open = false
  onclose?.(why)
}

/** Takes focus when the dialog appears and gives it back when the dialog goes, whoever closed it. */
function modal(node: HTMLElement): { destroy(): void } {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
  initialFocusIn(node).focus()
  return {
    destroy() {
      if (opener?.isConnected) opener.focus()
    },
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    // Swallowed even when the dialog cannot be dismissed, so a shortcut behind it never sees it.
    event.preventDefault()
    event.stopPropagation()
    if (dismissible) close('escape')
  } else if (dialog) trapTab(event, dialog)
}

function onPointerdown(event: PointerEvent): void {
  pressedScrim = event.target === event.currentTarget
}

function onClick(event: MouseEvent): void {
  const scrim = pressedScrim && event.target === event.currentTarget
  pressedScrim = false
  if (scrim && dismissible) close('scrim')
}
</script>

{#if open}
  <div
    class="scrim"
    data-dialog-root
    role="presentation"
    tabindex="-1"
    onkeydown={onKeydown}
    onpointerdown={onPointerdown}
    onclick={onClick}
  >
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
      tabindex="-1"
      data-widget="dialog"
      bind:this={dialog}
      use:modal
    >
      <h2 class="title" id={`${uid}-title`}>{title}</h2>
      <div class="body">{@render children()}</div>
      {#if actions}
        <div class="actions">{@render actions({ close: () => close('action') })}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: max(var(--space-4), env(safe-area-inset-top, 0px));
    padding-right: max(var(--space-4), env(safe-area-inset-right, 0px));
    padding-bottom: max(var(--space-4), env(safe-area-inset-bottom, 0px));
    padding-left: max(var(--space-4), env(safe-area-inset-left, 0px));
    background: rgb(0 0 0 / 0.55);
    outline: none;
  }
  .dialog {
    display: flex;
    flex-direction: column;
    width: min(26rem, 100%);
    max-height: 100%;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    outline: none;
  }
  .title {
    margin: 0;
    padding: var(--space-4) var(--space-4) var(--space-2);
    font: var(--text-title-15);
  }
  .body {
    min-height: 0;
    padding: 0 var(--space-4);
    overflow: auto;
    font: var(--text-body-13);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-4);
  }
  .actions :global(button) {
    min-width: var(--size-hit);
    min-height: var(--size-hit);
  }
  .actions :global([data-primary]) {
    min-height: var(--size-primary);
  }
</style>
