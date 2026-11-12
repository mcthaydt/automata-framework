<!--
  A bottom sheet: a raised surface that rises from the foot of the window over a scrim, for the menus a phone opens (the
  title menu, More, a list of choices). Opening remembers the focused element and moves focus into the sheet; Tab stays
  inside; Escape and a press that starts and ends on the scrim close it, and closing puts focus back where it was. It
  takes at most 72% of the window's height, scrolls inside when its content is longer, and keeps clear of the bottom
  safe area. The shell's own list and inspector sheets are not this: they stay mounted and move with CSS so a rotation
  keeps their focus and scroll (see `EditorShell`).
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import { initialFocusIn, trapTab } from '../widgets/focus-trap'

interface Props {
  open: boolean
  /** What the sheet is for, in words; it names the dialog. */
  label: string
  onclose: () => void
  children: Snippet
}

const { open, label, onclose, children }: Props = $props()

let sheet = $state<HTMLElement>()
let pressedScrim = false

/** Takes focus when the sheet appears and gives it back when it goes, whoever closed it. */
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
    event.preventDefault()
    event.stopPropagation()
    onclose()
  } else if (sheet) trapTab(event, sheet)
}

function onPointerdown(event: PointerEvent): void {
  pressedScrim = event.target === event.currentTarget
}

function onClick(event: MouseEvent): void {
  const scrim = pressedScrim && event.target === event.currentTarget
  pressedScrim = false
  if (scrim) onclose()
}
</script>

{#if open}
  <div
    class="scrim"
    data-sheet-root
    role="presentation"
    tabindex="-1"
    onkeydown={onKeydown}
    onpointerdown={onPointerdown}
    onclick={onClick}
  >
    <div class="sheet" role="dialog" aria-modal="true" aria-label={label} tabindex="-1" bind:this={sheet} use:modal>
      <span class="grabber" aria-hidden="true"></span>
      <div class="body" data-scroll-region>{@render children()}</div>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: var(--scrim);
    outline: none;
  }
  .sheet {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: min(32rem, 100%);
    max-height: 72%;
    border: 1px solid var(--line-strong);
    border-bottom: 0;
    border-radius: var(--edge-xl) var(--edge-xl) 0 0;
    background: var(--raise);
    box-shadow: var(--shadow-sheet);
    color: var(--ink);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    outline: none;
  }
  .grabber {
    flex: none;
    align-self: center;
    width: 36px;
    height: 4px;
    margin: var(--space-2) 0;
    border-radius: var(--edge-sm);
    background: var(--line-strong);
  }
  .body {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }
</style>
