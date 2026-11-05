// The camera drag: the player turns the camera freely, per pixel. One pointer
// drags at a time: a finger or pen on its primary contact, or a mouse with its secondary button, so a primary click
// on the scene is never a turn. Each move sends its horizontal pixels at once, with no dead zone and no smoothing,
// because the picture tracks the finger one to one. Which contacts may land here at all (never in the host's strip,
// never on a control) is the DOM surface's: it sits under the controls and outside `hostReserved`.
//
// Pure: pointer samples in, deltas out, no DOM and no clock.

/** What drove a drag: a finger or pen (`touch`), or the mouse. */
export type DragPointer = 'touch' | 'mouse'

/** Where drags go (`Input.drag`): CSS px moved to the right since the previous move, negative to the left. */
export interface DragSink {
  drag(dxPx: number, pointer: DragPointer): void
}

/** The parts of a `pointerdown` that decide whether it may drag. */
export interface DragStart {
  /** `PointerEvent.pointerType`: `touch`, `pen` or `mouse`. */
  readonly pointerType: string
  /** `PointerEvent.button`: 0 primary, 2 secondary. */
  readonly button: number
}

const PRIMARY_BUTTON = 0
const SECONDARY_BUTTON = 2

/**
 * Turns pointer samples into camera drags for one `DragSink`: one pointer at a time, its horizontal CSS px per move,
 * from a touch or pen's primary contact or the mouse's secondary button.
 */
export class CameraDragTracker {
  private pointerId: number | undefined
  private lastX = 0
  private pointer: DragPointer = 'touch'

  constructor(private readonly sink: DragSink) {}

  /** A pointer drives the drag now. */
  get dragging(): boolean {
    return this.pointerId !== undefined
  }

  /**
   * A pointer went down. It starts a drag only when none is in progress (or it is the dragging pointer again) and it
   * is a finger or pen on its primary contact or a mouse on its secondary button. True when it now drives the drag.
   */
  down(id: number, x: number, start: DragStart): boolean {
    // The dragging pointer pressing again lost its release (alt-tab, an OS gesture, a swallowed mouseup): it starts
    // afresh rather than leaving the drag stuck to it.
    if (id === this.pointerId) this.pointerId = undefined
    if (this.pointerId !== undefined) return false
    const pointer: DragPointer = start.pointerType === 'mouse' ? 'mouse' : 'touch'
    const wanted = pointer === 'mouse' ? SECONDARY_BUTTON : PRIMARY_BUTTON
    if (start.button !== wanted) return false
    this.pointerId = id
    this.lastX = x
    this.pointer = pointer
    return true
  }

  /** A pointer moved: the dragging one sends how far it went to the right. Others are ignored. */
  move(id: number, x: number): void {
    if (id !== this.pointerId) return
    const dx = x - this.lastX
    this.lastX = x
    if (dx !== 0) this.sink.drag(dx, this.pointer)
  }

  /** A pointer lifted: the drag ends if it was the dragging one. A finger still down never takes over. */
  up(id: number): void {
    if (id === this.pointerId) this.pointerId = undefined
  }

  /** The browser took the pointers (pointercancel, lost capture): the drag ends; what it sent stands. */
  cancel(): void {
    this.pointerId = undefined
  }
}
