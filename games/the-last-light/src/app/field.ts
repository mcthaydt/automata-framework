// The picture's size. It is the old game's: the window's own shape, never wider than 640 or taller than 480 (the old game's
// `pixelScale`: the renderer's resolution is `min(1, 640 / w, 480 / h)`), so a 16:9 window draws 640 by 360. The framework's own
// look draws a 180-line field, which is the framework's default and not this game's; the old game's figures and lines a metre
// are measured at this size (the plan's amendment 7).

/** The largest picture, in pixels. */
export const FIELD_CAP = { width: 640, height: 480 } as const

/** The phone held sideways the page is designed at first, and the field when the window has no size. */
const PHONE = { width: 844, height: 390 }

/** The field for a window of `screen` CSS pixels: its shape, scaled down to fit the cap, never up. The game is landscape. */
export function fieldFor(screen: { readonly width: number; readonly height: number }): {
  width: number
  height: number
} {
  const sized = screen.width > 0 && screen.height > 0
  const width = sized ? Math.max(screen.width, screen.height) : PHONE.width
  const height = sized ? Math.min(screen.width, screen.height) : PHONE.height
  const resolution = Math.min(1, FIELD_CAP.width / width, FIELD_CAP.height / height)
  return {
    width: Math.max(1, Math.round(width * resolution)),
    height: Math.max(1, Math.round(height * resolution)),
  }
}

/** The field for the window the page runs in; the phone's where there is none (a test in Node). */
export function fieldOfWindow(): { width: number; height: number } {
  if (typeof window === 'undefined') return fieldFor({ width: 0, height: 0 })
  return fieldFor({ width: window.innerWidth, height: window.innerHeight })
}
