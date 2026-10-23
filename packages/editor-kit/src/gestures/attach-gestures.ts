import { type GestureClock, realClock } from './gesture-clock'
import type { GestureHandlers } from './gesture-events'
import type { Modifiers, PointerKind, PointerSample, WheelInput } from './pointer-sample'
import { createRecognizer, type GestureOptions } from './recognizer'

export interface AttachOptions extends GestureOptions {
  /** Time source for the recognizer's timers; tests pass a fake. Default: the browser's. */
  readonly clock?: GestureClock
  /** Stop the browser's context menu on the element (a long press would raise it on iPad). Default true. */
  readonly preventContextMenu?: boolean
}

const LINE_PIXELS = 16

const modifiersOf = (event: MouseEvent | WheelEvent): Modifiers => ({
  shift: event.shiftKey,
  ctrl: event.ctrlKey,
  alt: event.altKey,
  meta: event.metaKey,
})

const kindOf = (pointerType: string): PointerKind =>
  pointerType === 'touch' || pointerType === 'pen' ? pointerType : 'mouse'

/**
 * Feeds an element's Pointer Events and wheel to a recognizer (editor kit spec §4.5). Sets `touch-action: none` and
 * stops text selection and the touch callout while attached; captures every pointer that presses so a drag that
 * leaves the element still arrives. Returns the teardown: it releases every captured pointer, removes the listeners
 * and restores the style, and nothing fires after it, not even a cancelled end.
 */
export function attachGestures(
  element: HTMLElement,
  handlers: GestureHandlers,
  options: AttachOptions = {},
): () => void {
  const recognizer = createRecognizer(handlers, options, options.clock ?? realClock)
  const preventContextMenu = options.preventContextMenu ?? true
  const pressed = new Set<number>()

  const style = element.style
  const restore = {
    touchAction: style.touchAction,
    userSelect: style.userSelect,
    webkitUserSelect: style.getPropertyValue('-webkit-user-select'),
    webkitTouchCallout: style.getPropertyValue('-webkit-touch-callout'),
  }
  style.touchAction = 'none'
  style.userSelect = 'none'
  style.setProperty('-webkit-user-select', 'none')
  style.setProperty('-webkit-touch-callout', 'none')

  function sampleOf(event: PointerEvent): PointerSample {
    const rect = element.getBoundingClientRect()
    return {
      id: event.pointerId,
      kind: kindOf(event.pointerType),
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      button: event.button,
      modifiers: modifiersOf(event),
    }
  }

  function release(id: number): void {
    try {
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id)
    } catch {
      // The pointer is already gone: nothing to release.
    }
  }

  const onDown = (event: PointerEvent): void => {
    pressed.add(event.pointerId)
    try {
      element.setPointerCapture(event.pointerId)
    } catch {
      // Capture is best effort: a synthetic pointer or one that already ended has nothing to capture.
    }
    recognizer.down(sampleOf(event))
  }

  const onMove = (event: PointerEvent): void => {
    if (!pressed.has(event.pointerId)) {
      recognizer.hover(sampleOf(event))
      return
    }
    // A Pencil reports faster than the frame rate: feed every coalesced sample so a stroke has no corners.
    const coalesced = event.getCoalescedEvents?.() ?? []
    for (const part of coalesced.length > 0 ? coalesced : [event]) recognizer.move(sampleOf(part))
  }

  const onUp = (event: PointerEvent): void => {
    if (!pressed.delete(event.pointerId)) return
    recognizer.up(sampleOf(event))
    release(event.pointerId)
  }

  const onCancel = (event: PointerEvent): void => {
    if (!pressed.delete(event.pointerId)) return
    recognizer.cancel(event.pointerId)
    release(event.pointerId)
  }

  const onWheel = (event: WheelEvent): void => {
    if (!handlers.wheel) return
    event.preventDefault()
    const rect = element.getBoundingClientRect()
    const unit = event.deltaMode === 1 ? LINE_PIXELS : event.deltaMode === 2 ? element.clientHeight : 1
    const input: WheelInput = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      deltaX: event.deltaX * unit,
      deltaY: event.deltaY * unit,
      modifiers: modifiersOf(event),
    }
    recognizer.wheel(input)
  }

  const onContextMenu = (event: Event): void => {
    if (preventContextMenu) event.preventDefault()
  }

  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointermove', onMove)
  element.addEventListener('pointerup', onUp)
  element.addEventListener('pointercancel', onCancel)
  element.addEventListener('lostpointercapture', onCancel)
  element.addEventListener('wheel', onWheel, { passive: false })
  element.addEventListener('contextmenu', onContextMenu)

  return () => {
    recognizer.dispose()
    element.removeEventListener('pointerdown', onDown)
    element.removeEventListener('pointermove', onMove)
    element.removeEventListener('pointerup', onUp)
    element.removeEventListener('pointercancel', onCancel)
    element.removeEventListener('lostpointercapture', onCancel)
    element.removeEventListener('wheel', onWheel)
    element.removeEventListener('contextmenu', onContextMenu)
    for (const id of pressed) release(id)
    pressed.clear()
    style.touchAction = restore.touchAction
    style.userSelect = restore.userSelect
    style.setProperty('-webkit-user-select', restore.webkitUserSelect)
    style.setProperty('-webkit-touch-callout', restore.webkitTouchCallout)
  }
}
