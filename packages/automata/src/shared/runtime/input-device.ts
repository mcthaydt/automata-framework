// The input service's device vocabulary, apart from the service so the presentation bus can name a
// device without importing the service.
import type { GlyphFamily } from './glyph-family.js'

/** A kind of input device. */
export type InputDevice = 'keyboard' | 'gamepad' | 'touch'
/** The device of the last real input, and the button labels of the active pad (`generic` before any pad). */
export interface ActiveDevice {
  readonly device: InputDevice
  readonly glyphs: GlyphFamily
}
/** A connected pad. Only `standard` pads drive bindings. */
export interface PadInfo {
  readonly index: number
  readonly id: string
  readonly standard: boolean
}
/** What input drives now: `play` (the game's bindings) or `menu` (the menu actions). */
export type InputContextNow = 'play' | 'menu'
