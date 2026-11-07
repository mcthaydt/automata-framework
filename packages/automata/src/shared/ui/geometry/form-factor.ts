/**
 * The four form factors (M1.6 spec §3.1; from FloorFifty `ui/form-factor.ts` at 122a220).
 *
 * Decided from the layout viewport's size alone. Whether the pointer is coarse is a different
 * question: it decides which controls mount, not how a screen is laid out. So a tablet with a
 * keyboard and a desktop with a touch screen both get the layout their shape asks for.
 *
 * The one place the thresholds live. CSS reads the answer from `data-form-factor`, script from
 * the geometry owner, and neither re-derives it.
 */

export type FormFactor = 'phone-portrait' | 'phone-landscape' | 'tablet-portrait' | 'desktop'

/** A portrait viewport narrower than this is a phone; at or above it, a tablet. */
export const PHONE_PORTRAIT_MAX_WIDTH = 600

/**
 * A landscape viewport shorter than this is a phone, or a desktop window short enough to need
 * the phone's compact layout. 500 keeps the 932 x 430 class of phone inside it with room to spare.
 */
export const PHONE_LANDSCAPE_MAX_HEIGHT = 500

/**
 * The form factor of a layout viewport: a portrait one narrower than 600 px is `phone-portrait`, any other
 * portrait one `tablet-portrait`; a landscape one shorter than 500 px is `phone-landscape`, otherwise
 * `desktop`. A square viewport is landscape.
 */
export function classifyFormFactor(width: number, height: number): FormFactor {
  // Strictly taller than wide is portrait; a square viewport is landscape.
  if (height > width) return width < PHONE_PORTRAIT_MAX_WIDTH ? 'phone-portrait' : 'tablet-portrait'
  return height < PHONE_LANDSCAPE_MAX_HEIGHT ? 'phone-landscape' : 'desktop'
}
