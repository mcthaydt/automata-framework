/**
 * A browser bar the browser has stopped telling the page about.
 *
 * DuckDuckGo for Android, with its address bar at the bottom, loses track of
 * that bar after its own keyboard closes (the address bar was edited, or a URL
 * was typed to open the game). The page is grown to the whole window -- 802 to
 * 866 px on the emulator -- and the bar is drawn back over its foot. Every
 * size the page can read agrees with the wrong height: `innerHeight`, the
 * visual viewport, `100dvh`, the safe-area insets. It lasts until the browser
 * is restarted, so there is no event to wait for and nothing stale to
 * re-measure.
 *
 * What does not move is the screen. The gap between it and the page is the
 * system bars plus the browser's bar when the browser is honest (113 px), and
 * the system bars alone when it is not (49 px). So the bar is recognised two
 * ways: against the largest settled gap this orientation has shown, which
 * catches the page growing mid-session, and, before an honest gap has been
 * seen, against a gap too small to hold any browser bar, which catches a page
 * that loaded already grown.
 */

/** One reading of the viewport, as `HiddenBrowserBar.measure` needs it. */
export type BarSample = {
  /** `screen.height`, in CSS pixels, for the current orientation. */
  screenHeight: number
  innerHeight: number
  portrait: boolean
  /** A text field has focus. This browser shrinks the whole page for its keyboard. */
  editing: boolean
  /** The page is fullscreen, where it legitimately reaches the screen edge. */
  fullscreen: boolean
  /** The size has stopped moving since the last reading. */
  settled: boolean
}

export class HiddenBrowserBar {
  /** The bottom address bar's height when the gap cannot say (measured: 64). */
  static readonly FALLBACK_HEIGHT = 64
  /**
   * The smallest honest portrait gap: a 24 px status bar and a 56 px address
   * bar, with no navigation bar at all. Below it, no bar is being accounted for.
   */
  static readonly MIN_PORTRAIT_GAP = 80
  /** A change in the gap smaller than this is the system, not a bar. */
  static readonly MIN_HEIGHT = 40
  /** Larger than this, and the page changed for some other reason. */
  static readonly MAX_HEIGHT = 120
  /** A gap larger than this is a keyboard, and is never learned. */
  static readonly MAX_LEARNED_GAP = 200

  private readonly honestGap = new Map<boolean, number>()

  /** How much of the page's foot the browser's bar covers, in CSS pixels. */
  measure(sample: BarSample): number {
    if (sample.fullscreen) return 0
    const gap = sample.screenHeight - sample.innerHeight

    if (sample.settled && !sample.editing && gap <= HiddenBrowserBar.MAX_LEARNED_GAP) {
      const known = this.honestGap.get(sample.portrait) ?? 0
      if (gap > known) this.honestGap.set(sample.portrait, gap)
    }

    const lost = (this.honestGap.get(sample.portrait) ?? 0) - gap
    if (lost >= HiddenBrowserBar.MIN_HEIGHT && lost <= HiddenBrowserBar.MAX_HEIGHT) return lost

    // Nothing honest seen yet in this orientation. Portrait only: a landscape
    // page's gap is small whether or not a bar is counted.
    if (
      sample.portrait &&
      !sample.editing &&
      lost < HiddenBrowserBar.MIN_HEIGHT &&
      gap < HiddenBrowserBar.MIN_PORTRAIT_GAP
    ) {
      return HiddenBrowserBar.FALLBACK_HEIGHT
    }
    return 0
  }
}

/** `navigator.userAgentData`, which the DOM typings do not carry yet. */
type Brands = { userAgentData?: { brands?: readonly { brand: string }[] } }

/** DuckDuckGo names itself only in the client-hint brands, not the user agent. */
export function isDuckDuckGo(nav: object): boolean {
  return (nav as Brands).userAgentData?.brands?.some((entry) => entry.brand === 'DuckDuckGo') ?? false
}
