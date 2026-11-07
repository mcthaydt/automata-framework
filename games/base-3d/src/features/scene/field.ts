// The pixel field's size: the look's short side, with the long side from the screen the game boots on. The letterbox
// draws the field the screen's whole width and centres it, so a field shaped like a phone held sideways leaves a
// tablet's screen a third empty above and below (G6); one shaped like the screen fills it. Presentation only: the sim
// never reads it (law 1).
import { DEFAULT_LOOK, targetSize } from '@automata/3d'

/** The phone held sideways the page is designed at first, and the field when the screen has no size. */
const PHONE = { width: 844, height: 390 }
/** The widest and the narrowest field, as width over height: an ultra-wide screen is cropped, not stretched. */
const ASPECT = { min: 1.3, max: 2.4 } as const

/** The look's field shaped like `screen`, its aspect kept between `ASPECT.min` and `ASPECT.max`. */
export function fieldFor(screen: { readonly width: number; readonly height: number }): {
  width: number
  height: number
} {
  const sized = screen.width > 0 && screen.height > 0
  const aspect = sized ? screen.width / screen.height : PHONE.width / PHONE.height
  const clamped = Math.min(ASPECT.max, Math.max(ASPECT.min, aspect))
  return targetSize({ width: clamped * 100, height: 100 }, DEFAULT_LOOK.pixel.short)
}

/** The field for the window the page runs in; the phone's where there is none (a test in Node). */
export function fieldOfWindow(): { width: number; height: number } {
  if (typeof window === 'undefined') return fieldFor({ width: 0, height: 0 })
  // The game is landscape (a portrait phone is told to turn), so the long side is the width whichever way it is held.
  return fieldFor({
    width: Math.max(window.innerWidth, window.innerHeight),
    height: Math.min(window.innerWidth, window.innerHeight),
  })
}
