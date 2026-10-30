<!--
  @component
  The camera drag surface (M4 spec §16.3.7, M3 spec §4.2 and §7): the player turns the camera by dragging the scene,
  a finger anywhere outside the controls or the mouse with its secondary button.

  All the rules of who drags are the tracker's (runtime `CameraDragTracker`); this forwards pointer events with their
  `clientX`. It is a fixed layer drawn under the play screen's controls, so a contact on a touch button, the stick,
  the corner controls or an ActionBar never reaches it, and its box stops short of the host's reserved strip and of
  what the browser lays over the page's foot, so a drag never starts inside `hostReserved`. Pointer only, never in
  the focus order.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import type { CameraDragSurfaceProps } from './camera-drag-surface'

const { tracker, testId = 'camera-drag' }: CameraDragSurfaceProps = $props()

/** What the surface shows: idle, or dragging by a finger or the mouse. */
let dragState = $state<'idle' | 'touch' | 'mouse'>('idle')
/** The pointer this surface captured for the drag; plain, so the release on teardown still sees it. */
let dragging: number | undefined

function down(event: PointerEvent): void {
  const start = { pointerType: event.pointerType, button: event.button }
  if (!tracker.down(event.pointerId, event.clientX, start)) return
  event.preventDefault()
  dragging = event.pointerId
  dragState = event.pointerType === 'mouse' ? 'mouse' : 'touch'
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  } catch {
    // A synthetic or already-ended pointer has nothing to capture; the drag still runs.
  }
}

function move(event: PointerEvent): void {
  tracker.move(event.pointerId, event.clientX)
}

/** A lift, a cancel and a lost capture alike: a lifted pointer loses its capture too. */
function up(event: PointerEvent): void {
  tracker.up(event.pointerId)
  if (event.pointerId !== dragging) return
  dragging = undefined
  dragState = 'idle'
}

onDestroy(() => tracker.cancel())

/**
 * Cancels the touch at its start (Chrome's long-press buzz, page scroll) and the context menu a secondary-button
 * drag would open. Non-passive, as `ontouch*` cannot be.
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
  class="af-camera-drag"
  data-testid={testId}
  data-camera-drag
  data-drag-state={dragState}
  role="presentation"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onlostpointercapture={up}
  {@attach blockPageGestures}
></div>

<style>
  /* The visible area less the host's strip: a contact in `hostReserved` stays the host's (M3 spec §7). */
  .af-camera-drag {
    position: fixed;
    inset: 0 var(--af-host-reserved-right, 0px) var(--af-visual-inset-bottom, 0px)
      var(--af-host-reserved-left, 0px);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .af-camera-drag[data-drag-state='mouse'] {
    cursor: grabbing;
  }
</style>
