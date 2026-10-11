/**
 * The viewports every primitive and screen is checked at (M1.6 spec §3.10).
 *
 * FloorFifty's `SWEEP` (tests/e2e/support/layout.ts at 122a220) plus both sides of every
 * breakpoint, so a classification that moves by one pixel shows up as a failure. Each size records
 * what it should classify as. This package does not depend on ui, so the names are written out
 * here, and ui's own test checks every size against its classifiers.
 */

/** `@mcthaydt/automata-ui`'s `FormFactor`. */
export type ReferenceFormFactor = 'phone-portrait' | 'phone-landscape' | 'tablet-portrait' | 'desktop'
/** `@mcthaydt/automata-ui`'s `HeightTier`. */
export type ReferenceHeightTier = 'short' | 'compact' | undefined

export interface ReferenceSize {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly formFactor: ReferenceFormFactor
  readonly heightTier: ReferenceHeightTier
  readonly group: 'phone' | 'tablet' | 'desktop' | 'boundary'
}

const size = (
  name: string,
  width: number,
  height: number,
  formFactor: ReferenceFormFactor,
  heightTier: ReferenceHeightTier,
  group: ReferenceSize['group'],
): ReferenceSize => ({ name, width, height, formFactor, heightTier, group })

export const REFERENCE_SIZES: readonly ReferenceSize[] = [
  size('phone-small', 360, 640, 'phone-portrait', undefined, 'phone'),
  size('iphone-se', 375, 667, 'phone-portrait', undefined, 'phone'),
  size('iphone-14', 390, 844, 'phone-portrait', undefined, 'phone'),
  size('iphone-pro-max', 430, 932, 'phone-portrait', undefined, 'phone'),
  size('iphone-se-landscape', 667, 375, 'phone-landscape', 'short', 'phone'),
  size('iphone-14-landscape', 844, 390, 'phone-landscape', 'short', 'phone'),
  size('iphone-pro-max-landscape', 932, 430, 'phone-landscape', 'short', 'phone'),
  // What a browser actually leaves a phone held sideways: the page never scrolls, so the toolbar
  // never hides. Chrome on a Galaxy, Safari on an iPhone 14, Safari on an iPhone SE (FloorFifty).
  size('galaxy-chrome-landscape', 780, 270, 'phone-landscape', 'compact', 'phone'),
  size('iphone-14-safari-landscape', 844, 340, 'phone-landscape', 'short', 'phone'),
  size('iphone-se-safari-landscape', 667, 320, 'phone-landscape', 'compact', 'phone'),
  // A wide, short desktop window classifies as a phone held sideways: its height decides.
  size('desktop-letterbox', 1280, 480, 'phone-landscape', 'short', 'desktop'),
  // A small laptop window or a half-screen browser.
  size('desktop-small', 900, 600, 'desktop', 'short', 'desktop'),
  size('desktop-720p', 1280, 720, 'desktop', undefined, 'desktop'),
  size('desktop-laptop', 1440, 900, 'desktop', undefined, 'desktop'),
  size('ipad-air-landscape', 1180, 820, 'desktop', undefined, 'tablet'),
  size('ipad-mini', 744, 1133, 'tablet-portrait', undefined, 'tablet'),
  size('ipad-air', 820, 1180, 'tablet-portrait', undefined, 'tablet'),
  size('ipad-pro', 1024, 1366, 'tablet-portrait', undefined, 'tablet'),
  // Both sides of each breakpoint. 900x600 (the short edge's inside) is `desktop-small` above.
  size('portrait-phone-edge', 599, 900, 'phone-portrait', undefined, 'boundary'),
  size('portrait-tablet-edge', 600, 900, 'tablet-portrait', undefined, 'boundary'),
  size('landscape-phone-edge', 900, 499, 'phone-landscape', 'short', 'boundary'),
  size('landscape-desktop-edge', 900, 500, 'desktop', 'short', 'boundary'),
  size('compact-edge', 900, 339, 'phone-landscape', 'compact', 'boundary'),
  size('short-from-compact-edge', 900, 340, 'phone-landscape', 'short', 'boundary'),
  size('tall-edge', 900, 601, 'desktop', undefined, 'boundary'),
]

/**
 * A condition layered over a reference size. Each field that is set applies; the caller turns them
 * into the geometry owner's inputs (a covered visual viewport, Ruken's display metrics).
 */
export interface Variant {
  readonly name: 'rest' | 'keyboard' | 'host-reserved-right' | 'host-reserved-left' | 'tv-scale'
  /** Px of the height the on-screen keyboard covers at this size. */
  readonly keyboard?: (size: ReferenceSize) => number
  /** Ruken's reserved strip (its fixture is 48 px wide). */
  readonly hostReserved?: { readonly edge: 'left' | 'right'; readonly width: number }
  /** Ruken's TV-mode scale hint. */
  readonly scale?: 1 | 1.333
}

export const VARIANTS: readonly Variant[] = [
  { name: 'rest' },
  // A phone keyboard takes a bit under half the screen; on a short landscape page that still leaves
  // a strip, which is exactly the case a screen must scroll for.
  { name: 'keyboard', keyboard: (at) => Math.round(at.height * 0.45) },
  { name: 'host-reserved-right', hostReserved: { edge: 'right', width: 48 } },
  { name: 'host-reserved-left', hostReserved: { edge: 'left', width: 48 } },
  { name: 'tv-scale', scale: 1.333 },
]
