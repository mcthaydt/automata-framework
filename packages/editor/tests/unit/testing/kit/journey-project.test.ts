import { describe, expect, it } from 'vitest'
import { IPAD_USER_AGENT, journeyInstance, journeyProject } from '#src/testing/kit/journey-project.ts'

// The iPad journeys' Vitest instance: an engine in a context with touch, a 2x screen and Safari's iPad user agent (WebKit
// is the journeys' own engine; Chromium honours the same context where WebKit is not installed). The provider factory is
// the config's `playwright`; here a stand-in records the options it was given.

describe('journeyInstance', () => {
  it('runs the engine asked for with a provider built for the iPad context', () => {
    const instance = journeyInstance((options) => ({ built: options.contextOptions }))('chromium')
    expect(instance).toEqual({
      browser: 'chromium',
      provider: {
        built: {
          hasTouch: true,
          deviceScaleFactor: 2,
          userAgent: IPAD_USER_AGENT,
          viewport: { width: 1194, height: 834 },
        },
      },
    })
  })

  it('is the instance the whole project uses', () => {
    const provider = (options: { contextOptions: unknown }) => ({ options })
    expect(journeyProject(provider).test.browser.instances).toEqual([{ browser: 'webkit' }])
    expect(journeyInstance(provider)('webkit').provider).toEqual(
      journeyProject(provider).test.browser.provider,
    )
  })

  it('runs in the engines a package asks for, WebKit alone by default', () => {
    const provider = (options: { contextOptions: unknown }) => ({ options })
    expect(journeyProject(provider).test.browser.instances).toEqual([{ browser: 'webkit' }])
    expect(journeyProject(provider, { browsers: ['chromium', 'webkit'] }).test.browser.instances).toEqual([
      { browser: 'chromium' },
      { browser: 'webkit' },
    ])
  })
})
