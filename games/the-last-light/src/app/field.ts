// The picture's size. It is the old game's: the largest picture is 640 by 480, and the window picks a whole scale and a field to
// match (`letterboxScale`, `src/render/crisp.ts` at 92e6704), so the picture fills the window in whole pixels. The framework's own
// look draws a 180-line field, which is the framework's default and not this game's; the old game's figures and lines a metre are
// measured at the field's height (the plan's amendment 7), so a smaller field shows less of the room, as it did in the old game.

/** The largest picture, in pixels. */
export const FIELD_CAP = { width: 640, height: 480 } as const

/**
 * The share of the picture's height each letterbox bar crops. The framework crops 5% by default, cinematic bars the old game drew
 * only in a cutscene, so play draws the whole picture: the bars would take 24 of its 480 lines and show a smaller room.
 */
export const BAR_FRACTION = 0

/** The phone held sideways the page is designed at first, and the field when the window has no size. */
const PHONE = { width: 844, height: 390 }

/**
 * The whole number of device pixels a field pixel is drawn at in a window of `screen` CSS pixels, by the old game's rule
 * (`letterboxScale`, `src/render/crisp.ts` at 92e6704): the window's device pixels per field pixel (`r`, the tighter of its two
 * sides against the cap) rounded down when that still fills 80% of it, else rounded up. A black border beats a coarser picture,
 * so a picture that would leave a wide one shrinks instead. The game is landscape, so the window's long side is its width.
 */
export function wholeScaleFor(
  screen: { readonly width: number; readonly height: number },
  ratio = 1,
): number {
  const [long, short] = sidesOf(screen, ratio)
  const r = Math.max(long / FIELD_CAP.width, short / FIELD_CAP.height)
  return Math.max(1, Math.floor(r) >= 0.8 * r ? Math.floor(r) : Math.ceil(r))
}

/** The window's long and short side in device pixels; the phone's when it has none. */
function sidesOf(
  screen: { readonly width: number; readonly height: number },
  ratio: number,
): [number, number] {
  const sized = screen.width > 0 && screen.height > 0
  const scale = ratio > 0 ? ratio : 1
  const long = Math.floor((sized ? Math.max(screen.width, screen.height) : PHONE.width) * scale)
  const short = Math.floor((sized ? Math.min(screen.width, screen.height) : PHONE.height) * scale)
  return [Math.max(1, long), Math.max(1, short)]
}

/**
 * The field for a window: the window's device pixels divided by the whole scale, capped at 640 by 480, so the picture fills the window
 * in whole pixels with no bars where the cap allows (1024 by 768 is 2x of 512 by 384; 1920 by 1080 is 3x of 640 by 360). A window held
 * upright has the same picture as one held sideways. The field is fixed when the game starts: see the plan's log for what a resize does.
 */
export function fieldFor(
  screen: { readonly width: number; readonly height: number },
  ratio = 1,
): { width: number; height: number } {
  const [long, short] = sidesOf(screen, ratio)
  const scale = wholeScaleFor(screen, ratio)
  return {
    width: Math.max(1, Math.min(FIELD_CAP.width, Math.floor(long / scale))),
    height: Math.max(1, Math.min(FIELD_CAP.height, Math.floor(short / scale))),
  }
}

/** The field for the window the page runs in; the phone's where there is none (a test in Node). */
export function fieldOfWindow(): { width: number; height: number } {
  if (typeof window === 'undefined') return fieldFor({ width: 0, height: 0 })
  return fieldFor({ width: window.innerWidth, height: window.innerHeight }, window.devicePixelRatio)
}
