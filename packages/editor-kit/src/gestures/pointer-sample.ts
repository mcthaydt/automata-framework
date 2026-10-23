// What the recognizer reads: one plain description of a pointer at one moment. The DOM adapter builds these from
// Pointer Events; tests build them by hand. Nothing here touches the DOM.

export type PointerKind = 'touch' | 'pen' | 'mouse'

export interface Modifiers {
  readonly shift: boolean
  readonly ctrl: boolean
  readonly alt: boolean
  readonly meta: boolean
}

export const NO_MODIFIERS: Modifiers = { shift: false, ctrl: false, alt: false, meta: false }

export interface PointerSample {
  /** The pointer's id (`PointerEvent.pointerId`); stable from `down` to `up`. */
  readonly id: number
  readonly kind: PointerKind
  /** Position in the element's own coordinates (CSS pixels from its top left). */
  readonly x: number
  readonly y: number
  readonly pressure: number
  readonly tiltX: number
  readonly tiltY: number
  /** `PointerEvent.button` of the press: 0 primary, 1 middle, 2 secondary. */
  readonly button: number
  readonly modifiers: Modifiers
}

/** A wheel or trackpad step in pixels (the adapter has already turned lines and pages into pixels). */
export interface WheelInput {
  readonly x: number
  readonly y: number
  readonly deltaX: number
  readonly deltaY: number
  readonly modifiers: Modifiers
}
