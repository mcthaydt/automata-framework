/**
 * Keeps a scroll region's drag inside it.
 *
 * A drag that carries on past a region's top edge is handed to the page, and
 * the page is the browser's: in fullscreen on a tablet, a downward pull the
 * page does not use reads as "leave fullscreen", so scrolling Settings back
 * to its top dropped the player out of it. `overscroll-behavior: contain`
 * (`theme.css`) is the declarative half, and Safari has not always honoured
 * it on touch; this is the half that cannot be ignored. A drag that no
 * scroller between the finger and the document can take any further is
 * cancelled, so nothing reaches the page. The walk runs past the element the
 * action sits on: a menu sheet that does not scroll itself sits in a screen
 * that does, and that screen still takes the drag.
 *
 * Vertical only. A mostly-sideways drag is left alone, so the controls tab's
 * sideways track and a slider still drag as they did.
 */

/** Whether a drag of `dy` (positive = finger moving down) would pass an edge. */
export function pastEdge(
  scroller: { scrollTop: number; scrollHeight: number; clientHeight: number },
  dy: number,
): boolean {
  const atTop = scroller.scrollTop <= 0
  const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
  // A finger moving down scrolls towards the top; up, towards the bottom.
  return (dy > 0 && atTop) || (dy < 0 && atBottom)
}

/** A Svelte action: `<div use:lockOverscroll>`. */
export function lockOverscroll(node: HTMLElement): { destroy(): void } {
  let lastX = 0
  let lastY = 0

  const onStart = (event: TouchEvent): void => {
    const touch = event.touches[0]
    if (touch === undefined) return
    lastX = touch.clientX
    lastY = touch.clientY
  }

  const onMove = (event: TouchEvent): void => {
    const touch = event.touches[0]
    if (touch === undefined || event.touches.length > 1) return
    const dx = touch.clientX - lastX
    const dy = touch.clientY - lastY
    lastX = touch.clientX
    lastY = touch.clientY
    if (Math.abs(dy) <= Math.abs(dx)) return
    if (event.cancelable && !someScrollerTakes(event.target, dy)) event.preventDefault()
  }

  node.addEventListener('touchstart', onStart, { passive: true })
  node.addEventListener('touchmove', onMove, { passive: false })
  return {
    destroy(): void {
      node.removeEventListener('touchstart', onStart)
      node.removeEventListener('touchmove', onMove)
    },
  }
}

/**
 * Whether a scrollable element between the touch and the document still has
 * room to scroll by `dy`. The document itself is left out: `html` and `body`
 * never scroll (`theme.css`), and a drag handed to them is the one to stop.
 */
function someScrollerTakes(target: EventTarget | null, dy: number): boolean {
  let at = target instanceof Element ? target : null
  const root = at?.ownerDocument.body ?? null
  while (at !== null && at !== root) {
    if (at instanceof HTMLElement && at.scrollHeight > at.clientHeight) {
      const overflow = getComputedStyle(at).overflowY
      if ((overflow === 'auto' || overflow === 'scroll') && !pastEdge(at, dy)) return true
    }
    at = at.parentElement
  }
  return false
}
