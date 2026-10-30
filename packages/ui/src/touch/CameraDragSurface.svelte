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
/**
 * A mouse drag is on, or just ended and its context menu may still come: on Windows it comes on the secondary
 * button's release, wherever the pointer is then, so the page's menu is cancelled until it has, or until the next
 * press.
 */
let menuPending = false

const MOUSE_SECONDARY_HELD = 2

function stop(): void {
  dragging = undefined
  dragState = 'idle'
}

function down(event: PointerEvent): void {
  const start = { pointerType: event.pointerType, button: event.button }
  if (!tracker.down(event.pointerId, event.clientX, start)) return
  event.preventDefault()
  dragging = event.pointerId
  dragState = event.pointerType === 'mouse' ? 'mouse' : 'touch'
  if (dragState === 'mouse') menuPending = true
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  } catch {
    // A synthetic or already-ended pointer has nothing to capture; the drag still runs.
  }
}

function move(event: PointerEvent): void {
  // A mouse that drags with its secondary button up lost the release (alt-tab, a swallowed mouseup): the drag ends
  // rather than turning the camera as the mouse hovers.
  if (
    event.pointerId === dragging &&
    event.pointerType === 'mouse' &&
    (event.buttons & MOUSE_SECONDARY_HELD) === 0
  ) {
    up(event)
    return
  }
  tracker.move(event.pointerId, event.clientX)
}

/** A lift, a cancel and a lost capture alike: a lifted pointer loses its capture too. */
function up(event: PointerEvent): void {
  tracker.up(event.pointerId)
  if (event.pointerId === dragging) stop()
}

/** The page-wide listeners: losing the window ends the drag; the context menu after a mouse drag is cancelled. */
function watchWindow(): () => void {
  const blur = (): void => {
    tracker.cancel()
    stop()
  }
  const menu = (event: Event): void => {
    if (!menuPending) return
    event.preventDefault()
    if (dragging === undefined) menuPending = false
  }
  // Capture: the next press anywhere but a drag ends the wait for a menu that never came (macOS and Linux open it
  // on the press, which the surface already cancelled).
  const press = (): void => {
    if (dragging === undefined) menuPending = false
  }
  window.addEventListener('blur', blur)
  window.addEventListener('contextmenu', menu, { capture: true })
  window.addEventListener('pointerdown', press, { capture: true })
  return () => {
    window.removeEventListener('blur', blur)
    window.removeEventListener('contextmenu', menu, { capture: true })
    window.removeEventListener('pointerdown', press, { capture: true })
  }
}
$effect(watchWindow)

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
