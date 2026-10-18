// The words of the display covers (M4 spec §4.9, §7), in the game's language.

/** The landscape gate's words: one tap to fullscreen, or how to play where a browser cannot hide its bar. */
export interface LandscapeGateCopy {
  readonly title: string
  readonly body: string
  /** The button that goes fullscreen. */
  readonly go: string
  readonly uprightTitle: string
  readonly uprightBody: string
}

/** The rotate hint's words. */
export interface RotateHintCopy {
  readonly title: string
  readonly body: string
}
