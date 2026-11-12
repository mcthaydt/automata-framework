// The colour look: which of two pictures an unlit colour makes on `@pixi/3d` 0.1.0-beta.3. Beta.2 drew an unlit material's base
// colour as its linear value (a 128 grey drew as 55) and a fog colour reached the screen darker (0x8b9bb4 as 0x425474); beta.3 draws
// both as authored. The framework was written round the first, so the move shows the Owner both and keeps this one switch
// until they choose, after which the loser's branches are deleted and so is this module.
// - 'authored' (the default): what beta.3 does. Fog reaches the fog colour and the sky fill is that colour; a lit moving thing's
//   colour (`tinted`) is its linear light times the light, encoded for the display.
// - 'beta2': the picture beta.2 drew. The fog colour handed to the view, and the sky, are the darker value beta.2 showed; a lit
//   moving thing's colour is that linear light as the display value. It cannot reproduce beta.2 for an unlit surface under fog,
//   which beta.2 did not mix up to the fog colour.
// It is read when a view is built and when a colour is tinted, so set it before the renderer is created.

export type ColourLook = 'authored' | 'beta2'

let look: ColourLook = 'authored'

/** The look in force. */
export const colourLook = (): ColourLook => look

/** Chooses the look for views built from now on. */
export function setColourLook(next: ColourLook): void {
  look = next
}
