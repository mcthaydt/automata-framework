<!--
  A question that needs an answer before the screen goes on (M1.6 spec §3.4; from Ruken
  `packages/ui/src/Dialog.svelte` at b30d31b). The screen renders it only while it is open
  (`{#if open}<Dialog>`) and decides what each action does; `onclose` is what Escape means, and it
  should mean the safe choice.

  Keyboard and focus:
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

/** Anything a keyboard can reach. (No layout in jsdom, so this does not look at visibility.) */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let panel = $state<HTMLElement | undefined>(undefined)
// False once the dialog starts to go away, so giving focus back is not undone by the trap
// pulling it into a dialog that is closing.
let trapping = false

function tabStops(): HTMLElement[] {
  return panel === undefined ? [] : Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
}

/**
 * The topmost open dialog: the last `aria-modal` in the document that is not inert. A dialog opened
 * over this one comes later in the document, as a sibling (which inerts this one) or inside it.
 */
function isTopmost(): boolean {
  const open = [...document.querySelectorAll('[aria-modal="true"]')].filter(
    (d) => d.closest('[inert]') === null,
  )
  return open.at(-1) === panel
}

/**
 * Marks everything outside `node` inert: the siblings of `node` and of each ancestor up to the
 * body. Returns how to undo it; only what this call marked is unmarked, so an element that was
 * already inert (or that an inner dialog marked) keeps its state.
 */
function inertOutside(node: Element): () => void {
  const marked: Element[] = []
  let current: Element = node
  while (current.parentElement !== null && current !== document.body) {
    for (const sibling of current.parentElement.children) {
      if (sibling === current || sibling.hasAttribute('inert')) continue
      sibling.setAttribute('inert', '')
      marked.push(sibling)
    }
    current = current.parentElement
  }
  return () => {
    for (const element of marked) element.removeAttribute('inert')
  }
}

function focusInitial(): void {
  const marked = panel?.querySelector<HTMLElement>('[data-initial-focus]')
  ;(marked ?? tabStops()[0] ?? panel)?.focus()
}

let scrim = $state<HTMLElement | undefined>(undefined)

onMount(() => {
  const opener = document.activeElement
  const release = scrim === undefined ? () => undefined : inertOutside(scrim)
  trapping = true
  focusInitial()
  return () => {
    trapping = false
    release()
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
  }
})

function onKeydown(event: KeyboardEvent): void {
  if (!isTopmost()) return
  if (event.key === 'Escape') {
    event.preventDefault()
    onclose()
    return
  }
  if (event.key !== 'Tab') return
  const controls = tabStops()
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (first === undefined || last === undefined) {
    event.preventDefault()
    panel?.focus()
  } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function onFocusIn(event: FocusEvent): void {
  if (!trapping || !isTopmost()) return
  if (panel !== undefined && event.target instanceof Node && !panel.contains(event.target)) focusInitial()
}
</script>

<svelte:window onkeydown={onKeydown} onfocusin={onFocusIn} />

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
