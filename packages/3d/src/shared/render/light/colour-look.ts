// The colour look: which of two pictures a lit moving thing's colour makes on `@pixi/3d` 0.1.0-beta.3. Beta.2 drew an unlit material's
// base colour as its linear value (a 128 grey drew as 55); beta.3 draws it as authored. The fog half of this switch is gone: fog and the
// sky are converted to beta.2's picture exactly (`view-fog.ts`, `unlit-material.ts`), so there is nothing to choose. What is left is a lit
// moving thing's colour (`tinted`, box-view.ts), until item 6 of the audit converts it too.
// - 'authored' (the default): its colour is its linear light times the light, encoded for the display.
// - 'beta2': that linear light as the display value, as beta.2 drew it.
// It is read when a colour is tinted, so set it before the renderer is created.

export type ColourLook = 'authored' | 'beta2'

let look: ColourLook = 'authored'

/** The look in force. */
export const colourLook = (): ColourLook => look

/** Chooses the look for views built from now on. */
export function setColourLook(next: ColourLook): void {
  look = next
}
