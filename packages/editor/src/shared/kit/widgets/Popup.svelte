<!--
  The surface under Menu and Picker (kit spec §4.6): one of two presentations the editor picks from the shell mode,
  a popover under its trigger on `wide` and a bottom sheet on `medium` and `compact`. It owns what they share:
  placement, dismissal and focus.

  The surface is moved to the end of `<body>` (or into the open dialog that holds the trigger), so a drawer's
  transform or clipping cannot move or cut it; a `position: fixed` popover would otherwise be placed against that
  drawer, not the screen. Escape closes it and stops there, so a dialog around it stays open. A press outside the
  popover closes it and lets the press through (one tap both closes the menu and does what it hit); a press on the
  sheet's scrim closes it. However it closes, focus goes back to the trigger; a press that lands on something
  focusable moves it on from there.

  `onopened` is told when the surface is in place, to move focus to the right thing; without it focus goes to the
  first thing inside that can take it.
-->
<script lang="ts">
import { type Snippet, tick } from 'svelte'
import { initialFocusIn } from './focus-trap'
import { placePopover } from './popup-model'

type CloseReason = 'escape' | 'outside' | 'scrim'

interface Props {
  open: boolean
  /** The trigger: the popover is placed against it, and focus returns to it. */
  anchor: HTMLElement | undefined
  presentation?: 'popover' | 'sheet'
  /** Names the sheet; a popover is named by what it holds. */
  label: string
  onclose?: ((why: CloseReason) => void) | undefined
  onopened?: ((root: HTMLElement) => void) | undefined
  children: Snippet
}

let {
  open = $bindable(),
  anchor,
  presentation = 'popover',
  label,
  onclose,
  onopened,
  children,
}: Props = $props()

let pressedScrim = false

function close(why: CloseReason): void {
  open = false
  onclose?.(why)
}

function surface(node: HTMLElement): { destroy(): void } {
  const trigger = anchor
  const host = trigger?.closest<HTMLElement>('[data-dialog-root]') ?? document.body
  host.append(node)

  const onOutside = (event: PointerEvent): void => {
    const target = event.target
    if (!(target instanceof Node) || node.contains(target) || trigger?.contains(target)) return
    close('outside')
  }
  document.addEventListener('pointerdown', onOutside, true)

  void tick().then(() => {
    if (!node.isConnected) return
    if (onopened) onopened(node)
    else initialFocusIn(node).focus()
  })

  return {
    destroy() {
      document.removeEventListener('pointerdown', onOutside, true)
      // Svelte removes a block's nodes by walking its own range, which no longer holds a moved node.
      node.remove()
      if (trigger?.isConnected) trigger.focus()
    },
  }
}

/** Places the popover against the trigger and keeps it there while the window resizes. */
function place(node: HTMLElement): { destroy(): void } {
  const apply = (): void => {
    if (!anchor) return
    const placed = placePopover(
      anchor.getBoundingClientRect(),
      { width: node.offsetWidth, height: node.scrollHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
    node.style.left = `${placed.left}px`
    node.style.top = `${placed.top}px`
    node.style.minWidth = `${placed.minWidth}px`
    node.style.maxHeight = `${placed.maxHeight}px`
    node.dataset.above = String(placed.above)
  }
  apply()
  window.addEventListener('resize', apply)
  return { destroy: () => window.removeEventListener('resize', apply) }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  close('escape')
}

function onPointerdown(event: PointerEvent): void {
  pressedScrim = event.target === event.currentTarget
}

function onClick(event: MouseEvent): void {
  const scrim = pressedScrim && event.target === event.currentTarget
  pressedScrim = false
  if (scrim) close('scrim')
}
</script>

{#if open}
  <div
    class="root"
    data-popup-root
    data-presentation={presentation}
    role="presentation"
    use:surface
    onkeydown={onKeydown}
    onpointerdown={onPointerdown}
    onclick={onClick}
  >
    {#if presentation === 'sheet'}
      <div class="sheet" role="group" aria-label={label}>
        <div class="grip" aria-hidden="true"></div>
        <div class="scroll">{@render children()}</div>
      </div>
    {:else}
      <div class="popover" use:place>{@render children()}</div>
    {/if}
  </div>
{/if}

<style>
  .root {
    position: fixed;
    inset: 0;
    z-index: 105;
  }
  .root[data-presentation='popover'] {
    pointer-events: none;
  }
  .root[data-presentation='sheet'] {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgb(0 0 0 / 0.45);
  }
  .popover {
    position: fixed;
    overflow: auto;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    pointer-events: auto;
  }
  .sheet {
    display: flex;
    flex-direction: column;
    width: min(40rem, 100%);
    max-height: min(70%, 32rem);
    padding-bottom: max(var(--space-4), env(safe-area-inset-bottom, 0px));
    border: 1px solid var(--color-border-strong);
    border-bottom: 0;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
  }
  .grip {
    flex: 0 0 auto;
    width: 36px;
    height: 4px;
    margin: var(--space-2) auto;
    border-radius: 2px;
    background: var(--color-border-strong);
  }
  .scroll {
    min-height: 0;
    overflow: auto;
  }
</style>
