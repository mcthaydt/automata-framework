<!--
  @component
  The whole visible screen as one swipe surface.

  All bookkeeping is the tracker's (runtime `SwipeTracker`); this forwards pointer events, each with its own
  `timeStamp`, and draws a thin thumb-to-anchor line so the player can see the dead zone. Which fingers may steer
  is the game's rule (`steers`); any finger may flick or tap. Controls a screen draws above this surface keep their
  taps. Pointer only, never in the focus order.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import type { SwipeIndicatorView, SwipeSurfaceProps } from './swipe-surface'

const { tracker, steers, testId = 'swipe-surface' }: SwipeSurfaceProps = $props()

let indicator = $state<SwipeIndicatorView | undefined>(undefined)
const sync = (): void => {
  indicator = tracker.indicator
}

const line = $derived.by(() => {
  if (indicator === undefined) return undefined
  const dx = indicator.thumb.x - indicator.anchor.x
  const dy = indicator.thumb.y - indicator.anchor.y
  return {
    x: indicator.anchor.x,
    y: indicator.anchor.y,
    length: Math.min(Math.hypot(dx, dy), tracker.tuning.saturationPx),
    angle: Math.atan2(dy, dx),
    steering: indicator.steering,
  }
})

function down(event: PointerEvent): void {
  event.preventDefault()
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  } catch {
    // A synthetic or already-ended pointer has nothing to capture.
  }
  const maySteer = steers?.(event.clientX, event.clientY) ?? true
  tracker.down(event.pointerId, event.clientX, event.clientY, event.timeStamp, { steers: maySteer })
  sync()
}

function move(event: PointerEvent): void {
  tracker.move(event.pointerId, event.clientX, event.clientY, event.timeStamp)
  sync()
}

/**
 * Per finger, for a lift, a cancel and a lost capture alike: a lifted finger loses its capture too, and releasing
 * every finger then stopped the other thumb steering.
 */
function up(event: PointerEvent): void {
  tracker.up(event.pointerId, event.clientX, event.clientY, event.timeStamp)
  sync()
}

onDestroy(() => tracker.cancel())

/** Cancels the touch at its start (Chrome's long-press buzz, page scroll). Non-passive, as `ontouch*` cannot be. */
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
  class="af-swipe"
  data-testid={testId}
  role="presentation"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onlostpointercapture={up}
  {@attach blockPageGestures}
>
  {#if line !== undefined}
    <div
      class="af-swipe__line"
      data-swipe-line
      data-steering={String(line.steering)}
      aria-hidden="true"
      style:left={`${line.x}px`}
      style:top={`${line.y}px`}
      style:width={`${line.length}px`}
      style:transform={`rotate(${line.angle}rad)`}
    ></div>
  {/if}
</div>

<style>
  /* The visible area: above a bar the browser lays over the page, so a thumb there still steers. */
  .af-swipe {
    position: fixed;
    inset: 0 0 var(--af-visual-inset-bottom, 0px) 0;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .af-swipe__line {
    position: fixed;
    height: 3px;
    transform-origin: 0 50%;
    background: var(--af-ink);
    opacity: 0.6;
    pointer-events: none;
  }

  /* Inside the dead zone: drawn faint, so the player sees it is not steering. */
  .af-swipe__line[data-steering='false'] {
    opacity: 0.25;
  }
</style>
