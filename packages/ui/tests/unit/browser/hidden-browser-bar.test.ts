import { describe, expect, it } from 'vitest'
import { type BarSample, HiddenBrowserBar, isDuckDuckGo } from '#src/browser/hidden-browser-bar.ts'

// Measured on DuckDuckGo for Android, bottom address bar, 412 x 915 screen:
// 802 px of page with the bar accounted for, 866 once the browser forgets it.
const SCREEN = 915
const HONEST = 802
const FORGOTTEN = 866

function sample(innerHeight: number, overrides: Partial<BarSample> = {}): BarSample {
  return {
    screenHeight: SCREEN,
    innerHeight,
    portrait: true,
    editing: false,
    fullscreen: false,
    settled: true,
    ...overrides,
  }
}

describe('HiddenBrowserBar', () => {
  it('reports nothing while the browser accounts for its bar', () => {
    const bar = new HiddenBrowserBar()
    expect(bar.measure(sample(HONEST))).toBe(0)
  })

  it("sees the page grow by the bar's height, and reports the difference", () => {
    const bar = new HiddenBrowserBar()
    bar.measure(sample(HONEST))
    expect(bar.measure(sample(FORGOTTEN))).toBe(FORGOTTEN - HONEST)
  })

  it('clears once the browser shrinks the page back', () => {
    const bar = new HiddenBrowserBar()
    bar.measure(sample(HONEST))
    bar.measure(sample(FORGOTTEN))
    expect(bar.measure(sample(HONEST))).toBe(0)
  })

  it('catches a page that loads already oversized, from the gap to the screen alone', () => {
    // Typing the URL into the address bar loads the game straight into this state.
    const bar = new HiddenBrowserBar()
    expect(bar.measure(sample(FORGOTTEN))).toBe(HiddenBrowserBar.FALLBACK_HEIGHT)
  })

  it('prefers what it learned over the fallback once the honest size has been seen', () => {
    // A device whose bar is taller than the fallback assumes.
    const bar = new HiddenBrowserBar()
    bar.measure(sample(FORGOTTEN))
    bar.measure(sample(790))
    expect(bar.measure(sample(FORGOTTEN))).toBe(FORGOTTEN - 790)
  })

  it('does not learn from a size that is still moving', () => {
    // The keyboard closing passes through heights a settled page never has.
    const bar = new HiddenBrowserBar()
    bar.measure(sample(700, { settled: false }))
    expect(bar.measure(sample(HONEST))).toBe(0)
  })

  it("does not learn from the page's own keyboard, which shrinks the page on this browser", () => {
    const bar = new HiddenBrowserBar()
    bar.measure(sample(490, { editing: true }))
    expect(bar.measure(sample(HONEST))).toBe(0)
  })

  it('reports nothing in fullscreen, where the page really does reach the screen edge', () => {
    const bar = new HiddenBrowserBar()
    bar.measure(sample(HONEST))
    expect(bar.measure(sample(SCREEN, { fullscreen: true }))).toBe(0)
  })

  it('uses no fallback in landscape, where the gap alone cannot tell the two apart', () => {
    const bar = new HiddenBrowserBar()
    expect(bar.measure(sample(360, { screenHeight: 412, portrait: false }))).toBe(0)
  })

  it('learns each orientation separately', () => {
    const bar = new HiddenBrowserBar()
    bar.measure(sample(HONEST))
    // A landscape page is far shorter than the portrait honest one, and is not a bar.
    expect(bar.measure(sample(300, { screenHeight: 412, portrait: false }))).toBe(0)
    expect(bar.measure(sample(FORGOTTEN))).toBe(FORGOTTEN - HONEST)
  })
})

describe('isDuckDuckGo', () => {
  it('reads the client-hint brands, since the user agent string does not name it', () => {
    expect(
      isDuckDuckGo({ userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'DuckDuckGo' }] } }),
    ).toBe(true)
    expect(
      isDuckDuckGo({ userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Google Chrome' }] } }),
    ).toBe(false)
    expect(isDuckDuckGo({})).toBe(false)
  })
})
