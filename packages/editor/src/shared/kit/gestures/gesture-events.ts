import type { Modifiers, PointerKind } from './pointer-sample'

// The events of the pointer pipeline (editor kit spec §4.5). Positions are in the element's coordinates.

export interface TapGesture {
  readonly x: number
  readonly y: number
  /** Taps in a row (1, 2, 3, …): same pointer kind, near each other, each within the double-tap gap of the last. */
  readonly count: number
  readonly pointerType: PointerKind
  readonly modifiers: Modifiers
}

export interface LongPressGesture {
  readonly x: number
  readonly y: number
  readonly pointerType: PointerKind
  readonly modifiers: Modifiers
}

export interface DragGesture {
  readonly x: number
  readonly y: number
  /** Where the press began. */
  readonly startX: number
  readonly startY: number
  /** Movement since the previous drag event; on `dragStart`, since the press. */
  readonly dx: number
  readonly dy: number
  readonly pressure: number
  readonly tiltX: number
  readonly tiltY: number
  readonly pointerType: PointerKind
  readonly button: number
  readonly modifiers: Modifiers
}

export interface DragStartGesture extends DragGesture {
  /** The drag began after the long press fired: how a held item is picked up and moved. */
  readonly afterLongPress: boolean
}

export interface DragEndGesture extends DragGesture {
  /** The pointer was cancelled, or another finger or the pen took over: nothing may commit. */
  readonly cancelled: boolean
}

export type TransformPhase = 'start' | 'change' | 'end'

/** Two touch pointers moving together. `x`, `y` is their centre; `dx`, `dy` is how far the centre moved. */
export interface PanGesture {
  readonly phase: TransformPhase
  readonly x: number
  readonly y: number
  readonly dx: number
  readonly dy: number
  /** Only on `end`. */
  readonly cancelled: boolean
}

/** Two touch pointers moving apart or together. `scale` is this step's ratio, `totalScale` the ratio since `start`. */
export interface PinchGesture {
  readonly phase: TransformPhase
  readonly x: number
  readonly y: number
  readonly scale: number
  readonly totalScale: number
  /** Radians, this step and since `start`; always 0 unless the options ask for rotation. */
  readonly rotation: number
  readonly totalRotation: number
  /** Only on `end`. */
  readonly cancelled: boolean
}

/** All fingers of a short, still touch lifted: two fingers (undo) or three (redo). `x`, `y` is where they landed. */
export interface MultiTapGesture {
  readonly x: number
  readonly y: number
  readonly fingers: number
}

/** A pen hovering or a mouse moving with no button down. */
export interface HoverGesture {
  readonly x: number
  readonly y: number
  readonly pointerType: PointerKind
  readonly pressure: number
  readonly tiltX: number
  readonly tiltY: number
  readonly modifiers: Modifiers
}

/**
 * Ctrl or Meta plus the wheel (what a trackpad pinch sends) zooms about the pointer; any other wheel pans.
 * `dx`, `dy` is how far the content should move on screen (the negated wheel delta), so `viewport.panBy(dx, dy)`
 * applies it. `scale` is the zoom factor for `zoom` and 1 for `pan`.
 */
export interface WheelGesture {
  readonly mode: 'zoom' | 'pan'
  readonly x: number
  readonly y: number
  readonly dx: number
  readonly dy: number
  readonly scale: number
  readonly modifiers: Modifiers
}

export interface GestureHandlers {
  tap?(event: TapGesture): void
  doubleTap?(event: TapGesture): void
  longPress?(event: LongPressGesture): void
  dragStart?(event: DragStartGesture): void
  drag?(event: DragGesture): void
  dragEnd?(event: DragEndGesture): void
  pan?(event: PanGesture): void
  pinch?(event: PinchGesture): void
  multiTap?(event: MultiTapGesture): void
  hover?(event: HoverGesture): void
  wheel?(event: WheelGesture): void
}
