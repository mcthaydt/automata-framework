<!--
  @component
  The on-screen touch buttons (M4 spec §4.4), from FloorFifty `ui/components/TouchControls.svelte` at `ac72660`.

  This is the element that produces pointer events and nothing more; the multi-touch bookkeeping is
  `touch-controls.ts`. Each side's group takes the pointers, not the buttons, and reaches `STICKY_MARGIN_PX` past
  them with an invisible margin, so a near miss presses the nearest button and a held thumb can slide from one to
  the next. The group captures the pointer, so the release always arrives, however far the thumb wanders.

  Pointer only: the buttons are never in the focus order, since a keyboard or pad drives the same actions directly.
  Hidden (not unmounted) while the player uses another device, so the screen never remounts; hiding or coming down
  releases whatever is held.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import type { TouchControlsProps } from './touch-button'
import { nearestTarget, PointerLatch, STICKY_MARGIN_PX, StickyPointers } from './touch-controls'

const { buttons, onhold, onrelease, shown = true, testId = 'touch-controls' }: TouchControlsProps = $props()

const latch = new PointerLatch((action, active) => (active ? onhold(action) : onrelease(action)))
const pointers = new StickyPointers(latch)

/** What each button draws as pressed, re-read after every pointer event. */
let held = $state<ReadonlySet<string>>(new Set())
const sync = (): void => {
  held = new Set(buttons.filter((button) => latch.isHeld(button.action)).map((button) => button.action))
}

let root = $state<HTMLElement | undefined>(undefined)
const sides = $derived(
  (['start', 'end'] as const)
    .map((side) => ({ side, buttons: buttons.filter((button) => (button.side ?? 'start') === side) }))
    .filter((group) => group.buttons.length > 0),
)

/**
 * The button under a pointer: the one it is directly on, or else the nearest within the margin. A captured
 * pointer's events all target the group, so a move is always resolved by geometry.
 */
function hit(event: PointerEvent): string | undefined {
  const direct = (event.target as Element | null)?.closest?.<HTMLElement>('[data-action]')
  if (direct != null) return direct.dataset['action']
  const targets = [...(root?.querySelectorAll<HTMLElement>('[data-action]') ?? [])].map((button) => ({
    action: button.dataset['action'] as string,
    rect: button.getBoundingClientRect(),
  }))
  return nearestTarget(event.clientX, event.clientY, targets)
}

function press(event: PointerEvent): void {
  event.preventDefault()
  if (!pointers.down(event.pointerId, hit(event))) return
  const group = event.currentTarget as HTMLElement
  try {
    group.setPointerCapture?.(event.pointerId)
  } catch {
    // A synthetic or already-ended pointer has nothing to capture; the hold still counts.
  }
  sync()
}

function slide(event: PointerEvent): void {
  pointers.move(event.pointerId, hit(event))
  sync()
}

function lift(event: PointerEvent): void {
  pointers.up(event.pointerId)
  sync()
}

$effect(() => {
  if (shown) return
  pointers.releaseAll()
  sync()
})
onDestroy(() => pointers.releaseAll())

/**
 * Cancels the touch at its start. Chrome on Android otherwise runs its long-press detector under a held thumb and
 * buzzes the phone as it offers to select, and a drag scrolls the page. Non-passive, which `ontouch*` cannot be.
 */
function blockPageGestures(node: HTMLElement): () => void {
  const stop = (event: Event): void => {
    if (event.cancelable) event.preventDefault()
  }
  node.addEventListener('touchstart', stop, { passive: false })
  node.addEventListener('touchmove', stop, { passive: false })
  node.addEventListener('contextmenu', stop)
  return () => {
    node.removeEventListener('touchstart', stop)
    node.removeEventListener('touchmove', stop)
    node.removeEventListener('contextmenu', stop)
  }
}
</script>

<div
  bind:this={root}
  class="af-touch"
  data-testid={testId}
  hidden={!shown}
  style:--af-sticky-margin={`${STICKY_MARGIN_PX}px`}
  {@attach blockPageGestures}
>
  {#each sides as group (group.side)}
    <div
      class="af-touch__side"
      data-touch-side={group.side}
      role="presentation"
      onpointerdown={press}
      onpointermove={slide}
      onpointerup={lift}
      onpointercancel={lift}
      onlostpointercapture={lift}
    >
      {#each group.buttons as button (button.action)}
        <button
          type="button"
          class="af-control af-touch__button"
          data-testid={button.action}
          data-action={button.action}
          data-held={String(held.has(button.action))}
          tabindex="-1"
          aria-label={button.ariaLabel ?? button.label}>{button.label}</button
        >
      {/each}
    </div>
  {/each}
</div>

<style>
  .af-touch {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    pointer-events: auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .af-touch[hidden] {
    display: none;
  }

  /* The sticky margin: an invisible box past the buttons that belongs to the group, so a near miss lands on the
     group and is resolved to the nearest button. Painted under the buttons, and changing no layout. */
  .af-touch__side {
    position: relative;
    z-index: 0;
    display: flex;
    gap: 12px;
  }

  .af-touch__side::before {
    content: '';
    position: absolute;
    inset: calc(-1 * var(--af-sticky-margin));
    z-index: -1;
  }

  .af-touch__side[data-touch-side='end'] {
    margin-inline-start: auto;
  }

  /* A thumb's target, pressed without looking: never below the primary size. */
  .af-touch__button {
    min-width: var(--af-target-primary);
    min-height: var(--af-target-primary);
    touch-action: none;
  }

  /* The pressed state, from the latch rather than `:active`: a near miss or a slide presses a button the finger is
     not on. One pixel down, and edged in the accent, so it reads by more than shade. */
  .af-touch__button[data-held='true'] {
    border-color: var(--af-accent);
    transform: translateY(1px);
  }
</style>
