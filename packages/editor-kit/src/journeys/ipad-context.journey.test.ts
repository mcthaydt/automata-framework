import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { IPAD_PROFILES } from '../testing/ipad-profiles'

// The journeys' browser is WebKit dressed as an iPad (plan EDK.6b decision 1): a coarse pointer with no hover, touch
// events, a 2× screen and Safari's iPad user agent, at each profile's window size. Playwright's WebKit on Linux reports
// `navigator.maxTouchPoints` as 0 even with touch on, so nothing here relies on it (the one reader in `ui` also matches
// an iPad by its user agent).

describe('the iPad journey context', () => {
  it.each(IPAD_PROFILES)('is a touch iPad at $name', async (profile) => {
    await page.viewport(profile.width, profile.height)
    expect(matchMedia('(pointer: coarse)').matches).toBe(true)
    expect(matchMedia('(hover: none)').matches).toBe(true)
    expect('ontouchstart' in window).toBe(true)
    expect(window.devicePixelRatio).toBe(2)
    expect(navigator.userAgent).toContain('iPad')
    expect(window.innerWidth).toBe(profile.width)
    expect(window.innerHeight).toBe(profile.height)
  })
})
