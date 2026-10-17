<!--
  A question that needs an answer before the screen goes on (M1.6 spec §3.4; from Ruken
  `packages/ui/src/Dialog.svelte` at b30d31b). The screen renders it only while it is open
  (`{#if open}<Dialog>`) and decides what each action does; `onclose` is what Escape means, and it
  should mean the safe choice.

  Keyboard and focus (the rules live in `modal-scope.ts`, which Modal and Sheet share):
  - Initial focus goes to the control marked `data-initial-focus` (the safe action), else the
    first control, else the dialog itself.
  - Tab and Shift+Tab wrap inside the dialog, and focus that lands outside it is pulled back in.
    The scrim covers the page, so a pointer cannot reach out either.
  - When the dialog goes away, focus returns to whatever had it before the dialog opened.
  - Escape calls `onclose`. The focus navigator's Back arrives as Escape, so a controller closes
    it the same way. With dialogs stacked, only the topmost answers Escape and holds focus.
  - While it is open the page behind it is `inert` (every sibling of the dialog and of each of its
    ancestors up to the body), so assistive technology and the browser cannot reach it either.

  Layout: a sheet on the bottom edge on a phone, centred otherwise; always inside the insets and
  above the keyboard. Its body is a declared scroll region, so on a 780 x 270 screen the actions
  stay reachable however long the text is.
-->
<script lang="ts">
import { onMount, type Snippet } from 'svelte'
import { holdModal } from './modal-scope.js'

interface Props {
  title: string
  /** Escape, and anything else that means "never mind". The screen closes the dialog. */
  onclose: () => void
  /** The dialog's text; also its accessible description. */
  children?: Snippet | undefined
  /** The buttons, in reading order. Mark the safe one with `data-initial-focus`. */
  actions?: Snippet | undefined
}

const { title, onclose, children, actions }: Props = $props()

const id = $props.id()
const titleId = `${id}-title`
const bodyId = `${id}-body`

let scrim = $state<HTMLElement | undefined>(undefined)
let panel = $state<HTMLElement | undefined>(undefined)

onMount(() =>
  scrim === undefined || panel === undefined ? undefined : holdModal(scrim, panel, () => onclose()),
)
</script>

<div bind:this={scrim} class="af-dialog-scrim" data-testid="dialog-scrim">
  <div
    bind:this={panel}
    class="af-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={bodyId}
    tabindex="-1"
  >
    <h2 id={titleId} class="af-dialog__title">{title}</h2>
    <div id={bodyId} class="af-dialog__body" data-scroll-region>
      {#if children}{@render children()}{/if}
    </div>
    {#if actions}
      <div class="af-dialog__actions">{@render actions()}</div>
    {/if}
  </div>
</div>

<style>
  /* Covers the visible region, so nothing behind can be pressed; inside the insets and above the
     keyboard. */
  .af-dialog-scrim {
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

  .af-dialog {
    box-sizing: border-box;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 12px;
    width: 100%;
    max-width: 28rem;
    max-height: 100%;
    padding: 20px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: var(--af-radius);
    background: var(--af-panel);
    color: var(--af-ink);
    font: var(--af-text-body) / 1.4 var(--af-font);
  }

  .af-dialog:focus {
    outline: none;
  }

  /* A phone's dialog is a sheet on the bottom edge, where a thumb reaches its actions. */
  :global([data-form-factor="phone-portrait"]) .af-dialog-scrim,
  :global([data-form-factor="phone-landscape"]) .af-dialog-scrim {
    align-items: flex-end;
    padding-bottom: var(--af-inset-bottom, 0px);
  }

  :global([data-form-factor="phone-portrait"]) .af-dialog,
  :global([data-form-factor="phone-landscape"]) .af-dialog {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  /* A short screen spends less on padding; the actions keep their targets. */
  :global([data-height="compact"]) .af-dialog {
    padding: 12px 16px;
    gap: 8px;
  }

  .af-dialog__title {
    margin: 0;
    font-size: calc(var(--af-text-body) * 1.25);
    line-height: 1.2;
  }

  .af-dialog__body {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    color: var(--af-muted);
  }

  .af-dialog__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .af-dialog__actions > :global(*) {
    flex: 1 1 auto;
  }
</style>
