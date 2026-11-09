<!--
  @component
  The on-screen touch buttons.

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
import { observeWidth } from '../layout/observe-size'
import TouchStick from './TouchStick.svelte'
import type { TouchControlsProps } from './touch-button'
import { nearestTarget, PointerLatch, STICKY_MARGIN_PX, StickyPointers, shownButtons } from './touch-controls'

// `shown` is the prop's name (the player uses touch); inside it is `visible`.
const {
  buttons,
  onhold,
  onrelease,
  shown: visible = true,
  stick,
  onstick = () => undefined,
  onstickend = () => undefined,
  testId = 'touch-controls',
}: TouchControlsProps = $props()

const latch = new PointerLatch((action, active) => (active ? onhold(action) : onrelease(action)))
const pointers = new StickyPointers(latch)

/** What each button draws as pressed, re-read after every pointer event. */
let held = $state<ReadonlySet<string>>(new Set())
const sync = (): void => {
  held = new Set(buttons.filter((button) => latch.isHeld(button.action)).map((button) => button.action))
}

let root = $state<HTMLElement | null | undefined>(undefined)

// The reduced set: `needed` is one row's width with every button, measured while they all show;
// where the controls are narrower than that, only the required buttons show. Widening past it shows them all again.
let reduced = $state(false)
let needed = 0
const showing = $derived(shownButtons(buttons, !reduced))
function fit(width: number): void {
  // A bound element is null, not undefined, once it goes.
  if (root == null) return
  if (!reduced) {
    // The stick is never dropped, but it takes its share of the row.
    const groups = [...root.querySelectorAll<HTMLElement>('.af-touch__stick, .af-touch__side')]
    const gap = Number.parseFloat(getComputedStyle(root).columnGap) || 0
    // The stick's box, not its scroll width: a held ring drawn past the zone's edge takes no room in the row.
    const width = (group: HTMLElement): number =>
      group.classList.contains('af-touch__stick') ? group.offsetWidth : group.scrollWidth
    needed = groups.reduce((sum, group) => sum + width(group), 0) + gap * Math.max(0, groups.length - 1)
  }
  reduced = buttons.some((button) => button.required === true) && needed > width + 0.5
}
$effect(() => {
  void showing
  if (root != null) fit(root.clientWidth)
})
$effect(() => (root == null ? undefined : observeWidth(root, fit)))

const sides = $derived(
  (['start', 'end'] as const)
    .map((side) => ({ side, buttons: showing.filter((button) => (button.side ?? 'start') === side) }))
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
  if (visible) return
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
  data-touch-overlay
  data-reduced={reduced ? '' : undefined}
  hidden={!visible}
  style:--af-sticky-margin={`${STICKY_MARGIN_PX}px`}
  {@attach blockPageGestures}
>
  {#if stick !== undefined}
    <TouchStick label={stick.label} {onstick} {onstickend} shown={visible} />
  {/if}
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
    /* Only the stick and the button groups take the pointer: the gaps between them are the scene's, so a camera drag
       can start there. */
    pointer-events: none;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .af-touch[hidden] {
    display: none;
  }

  /* The sticky margin: an invisible box past the buttons that belongs to the group, so a near miss lands on the
     group and is resolved to the nearest button. Painted under the buttons, and changing no layout. It reaches
     sideways and down, never up: what sits above the buttons (an ActionBar, a screen's controls) keeps its taps. */
  .af-touch__side {
    position: relative;
    z-index: 0;
    pointer-events: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    /* A side may be narrower than its buttons in one row: a long label in another language wraps the row. */
    min-width: 0;
  }

  .af-touch__side::before {
    content: '';
    position: absolute;
    inset: 0 calc(-1 * var(--af-sticky-margin)) calc(-1 * var(--af-sticky-margin));
    z-index: -1;
  }

  .af-touch__side[data-touch-side='end'] {
    margin-inline-start: auto;
  }

  /* A thumb's target, pressed without looking: never below the primary size. */
  .af-touch__button {
    min-width: var(--af-target-primary);
    min-height: var(--af-target-primary);
    /* A label longer than the row breaks inside the button rather than pushing the row off screen (the xx-long pseudo-locale). */
    overflow-wrap: anywhere;
    touch-action: none;
  }

  /* The pressed state, from the latch rather than `:active`: a near miss or a slide presses a button the finger is
     not on. One pixel down, and edged in the accent, so it reads by more than shade. */
  .af-touch__button[data-held='true'] {
    border-color: var(--af-accent);
    transform: translateY(1px);
  }
</style>
