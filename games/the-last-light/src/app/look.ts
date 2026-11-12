import { DEFAULT_LOOK } from '@automata/3d'

// The picture's look: the framework's, with the field the old game's and the haze the old game's. Presentation only.

/** The old game's fog colour (`src/render/look.ts` `HAZE.color` at 92e6704): a dim grey-green. */
const OLD_HAZE = 0x4b5a56

/**
 * The colour of the bars round the picture: black, as the old game's page was (`--c-void: #000000` in `src/style.css` at 92e6704).
 * The framework's own bar is DUEL's darkest plum; this is the game's, and the only thing it changes: the clear colour inside the
 * picture, the vignette and the fog's far colour are the look's own.
 */
export const BAR_COLOR = 0x000000

/** One sRGB channel (0 to 255) as linear light (0 to 1). */
const linear = (channel: number): number => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/**
 * The colour a `@pixi/3d` 0.1.0-beta.2 fog colour reaches the screen as: its linear value, read as if it were sRGB. The old game's
 * fog was that view fog, so its dim grey-green drew as a much darker one; the framework's haze is a post pass that draws its colour
 * as given, so it takes this.
 */
export function hazeColourOf(fog: number): string {
  const byte = (shift: number): string =>
    Math.round(255 * linear((fog >> shift) & 255))
      .toString(16)
      .padStart(2, '0')
  return `#${byte(16)}${byte(8)}${byte(0)}`
}

/**
 * The game's look for a picture of `size`: the framework's, drawn at the picture's own short side, with the old game's haze. The old
 * fog ran from 5 m before the focus to 7 m past it, wholly the fog colour at the far end and with no light added to it; the
 * framework's haze starts at the focus at the earliest, so it runs from there to the same far end. The haze measures from the focus,
 * which for a perspective camera is `focus` metres from the eye (the play camera's distance; the framework's own 3 m is a first-person
 * lens's and would put the whole room past the haze's far end).
 */
export function lookOf(
  size: { readonly width: number; readonly height: number },
  focus: number,
): typeof DEFAULT_LOOK {
  return {
    ...DEFAULT_LOOK,
    pixel: { short: Math.min(size.width, size.height) },
    haze: {
      ...DEFAULT_LOOK.haze,
      colour: hazeColourOf(OLD_HAZE),
      near: 0,
      far: 7,
      amount: 1,
      glow: 0,
      focusFp: focus,
    },
  }
}
