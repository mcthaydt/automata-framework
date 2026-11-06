<!--
  A modal dialog over a scrim. It is not a native `<dialog>`: it owns its focus, which is what the
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
  /** `wide` (up to 40rem) makes room for a text view or a table; the default is a 26rem confirmation. */
  width?: 'normal' | 'wide' | undefined
  onclose?: ((why: CloseReason) => void) | undefined
  children: Snippet
  actions?: Snippet<[{ close: () => void }]> | undefined
}

let {
  open = $bindable(),
  title,
  dismissible = true,
  width = 'normal',
  onclose,
  children,
  actions,
}: Props = $props()

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
      data-width={width}
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
    background: var(--scrim);
    outline: none;
  }
  .dialog {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: min(26rem, 100%);
    max-height: 100%;
    border: 1px solid var(--line);
    border-radius: var(--edge);
    background: var(--paper);
    box-shadow: var(--shadow-sheet);
    color: var(--ink);
    outline: none;
  }
  .dialog[data-width='wide'] {
    width: min(40rem, 100%);
  }
  .title {
    margin: 0;
    padding: var(--space-5) var(--space-5) var(--space-2);
    font: var(--text-title-15);
    letter-spacing: -0.01em;
  }
  .body {
    min-height: 0;
    padding: 0 var(--space-5);
    overflow: auto;
    color: var(--muted);
    font: var(--text-body-13);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-5);
  }
  .actions :global(button) {
    min-width: var(--size-hit);
    min-height: var(--size-hit);
  }
  /* The kit's Button marks its primary kind with `data-kind`. Both selectors weigh as much as the rule above and come
     after it, so a primary action keeps its 48 px wherever its own stylesheet lands in the page. */
  .actions :global([data-primary]),
  .actions :global([data-kind='primary']) {
    min-height: var(--size-primary);
  }
  .actions :global(button:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  /* The scrim covers the viewport, so the viewport is the dialog's container here.
     On a phone-width screen the dialog is a sheet from the bottom, edge to edge, with a grab handle; the actions stack
     with the primary one first and full width, so it is always in reach of a thumb and never off screen. */
  @media (max-width: 37.5rem) {
    .scrim {
      align-items: flex-end;
      padding: 0;
    }
    .dialog,
    .dialog[data-width='wide'] {
      width: 100%;
      max-height: calc(100% - var(--space-6));
      border-bottom: 0;
      border-radius: var(--edge);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .dialog::before {
      content: '';
      align-self: center;
      width: 36px;
      height: 4px;
      margin-top: var(--space-2);
      border-radius: var(--edge);
      background: var(--line-strong);
    }
    .actions {
      flex-direction: column-reverse;
      align-items: stretch;
    }
    .actions :global(button) {
      min-height: var(--size-primary);
    }
  }
</style>
