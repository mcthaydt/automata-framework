<!--
  A panel over the screen with a visible Close (M4 spec §4.12; the rules of FloorFifty
  `ui/components/Modal.svelte` at ac72660). Where Dialog asks a question that needs an answer,
  Modal shows something the player can close at any time: a level list, a credits page.

  It holds the page by the rules Dialog uses (`modal-scope.ts`): the page behind is inert, focus
  moves in on open and back to the opener on close, Tab wraps, and Escape (or the pad's Back)
  calls `onclose`. A tap on the dimmed page calls `onbackdrop` only when one is given; absent,
  such a tap does nothing, so a stray tap never loses the player's place.

  `anchor="bottom"` puts it on the bottom edge at every form factor; Sheet is that.
-->
<script lang="ts" module>
import type { Snippet } from 'svelte'

export interface ModalProps {
  title: string
  /** The Close button's name, in the game's language. */
  closeLabel: string
  onclose: () => void
  /** A tap on the dimmed page around the panel; absent, such a tap does nothing. */
  onbackdrop?: (() => void) | undefined
  children?: Snippet | undefined
  /** The buttons, in reading order. Mark the safe one with `data-initial-focus`. */
  actions?: Snippet | undefined
  testId?: string | undefined
}
</script>

<script lang="ts">
import { onMount } from 'svelte'
import { holdModal } from './modal-scope.js'

const {
  title,
  closeLabel,
  onclose,
  onbackdrop,
  children,
  actions,
  testId,
  anchor = 'center',
}: ModalProps & { anchor?: 'center' | 'bottom' | undefined } = $props()

const id = $props.id()
const titleId = `${id}-title`

let scrim = $state<HTMLElement | undefined>(undefined)
let panel = $state<HTMLElement | undefined>(undefined)

onMount(() => (scrim === undefined || panel === undefined ? undefined : holdModal(scrim, panel, () => onclose())))

function onScrimClick(event: MouseEvent): void {
  if (event.target === scrim) onbackdrop?.()
}
</script>

<!-- The scrim's click is a pointer convenience; Escape and Close are the keyboard and pad routes. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div bind:this={scrim} class="af-modal-scrim" data-modal-scrim data-anchor={anchor} onclick={onScrimClick}>
  <div
    bind:this={panel}
    class="af-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
    data-testid={testId}
  >
    <div class="af-modal__head">
      <h2 id={titleId} class="af-modal__title">{title}</h2>
      <button
        type="button"
        class="af-control af-control--ghost af-modal__close"
        data-modal-close
        aria-label={closeLabel}
        title={closeLabel}
        onclick={() => onclose()}
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
    <div class="af-modal__body" data-scroll-region>
      {#if children}{@render children()}{/if}
    </div>
    {#if actions}
      <div class="af-modal__actions">{@render actions()}</div>
    {/if}
  </div>
</div>

<style>
  /* Covers the visible region, so nothing behind can be pressed; inside the insets and above the keyboard. */
  .af-modal-scrim {
    position: fixed;
    inset: 0 0 var(--af-visual-inset-bottom, 0px);
    z-index: 100;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(var(--af-gutter), var(--af-inset-top, 0px)) max(var(--af-gutter), var(--af-inset-right, 0px))
      max(var(--af-gutter), var(--af-inset-bottom, 0px)) max(var(--af-gutter), var(--af-inset-left, 0px));
    background: var(--af-scrim);
  }

  .af-modal {
    box-sizing: border-box;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 12px;
    width: 100%;
    max-width: 32rem;
    max-height: 100%;
    padding: 16px 20px 20px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: var(--af-radius);
    background: var(--af-panel);
    color: var(--af-ink);
    font: var(--af-text-body) / 1.4 var(--af-font);
  }

  .af-modal:focus {
    outline: none;
  }

  /* A sheet sits on the bottom edge at every size, where a thumb reaches its actions. */
  .af-modal-scrim[data-anchor="bottom"] {
    align-items: flex-end;
    padding-bottom: var(--af-inset-bottom, 0px);
  }

  .af-modal-scrim[data-anchor="bottom"] .af-modal {
    max-width: 40rem;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  :global([data-height="compact"]) .af-modal {
    padding: 8px 16px 12px;
    gap: 8px;
  }

  .af-modal__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .af-modal__title {
    flex: 1;
    margin: 0;
    font-size: calc(var(--af-text-body) * 1.25);
    line-height: 1.2;
  }

  .af-modal__close {
    flex: none;
    padding: 0;
  }

  .af-modal__body {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .af-modal__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .af-modal__actions > :global(*) {
    flex: 1 1 auto;
  }
</style>
