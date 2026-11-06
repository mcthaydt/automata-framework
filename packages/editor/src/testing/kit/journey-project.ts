// The `journeys` Vitest project every editor package spreads into its config (plan EDK.6b decision 1), so the 2D, 3D
// and suite lanes run their iPad journeys the same way: WebKit, in a context with touch, a 2× screen and Safari's iPad
// user agent, over the package's `*.journey.test.ts` files. The config hands it `playwright` from
// `@vitest/browser-playwright`, so this module never loads the provider itself and stays importable anywhere.

/** Safari on an iPad running iPadOS 18, as the user agent the journeys' pages see. */
export const IPAD_USER_AGENT: string =
  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

/** The Playwright browser context the journeys run in. */
export interface JourneyContextOptions {
  readonly hasTouch: boolean
  readonly deviceScaleFactor: number
  readonly userAgent: string
  readonly viewport: { readonly width: number; readonly height: number }
}

const contextOptions: JourneyContextOptions = {
  hasTouch: true,
  deviceScaleFactor: 2,
  userAgent: IPAD_USER_AGENT,
  viewport: { width: 1194, height: 834 },
}

/** `playwright` from `@vitest/browser-playwright`, or a stand-in in a test. */
export type ProviderFactory<P> = (options: { readonly contextOptions: JourneyContextOptions }) => P

export interface JourneyProjectOptions {
  /** The journey files; `src/**\/*.journey.test.ts` by default. */
  readonly include?: readonly string[]
}

/** A Vitest project config (what `projects` takes). */
export interface JourneyProject<P> {
  readonly extends: true
  readonly resolve: { conditions: string[] }
  /** What the iPad context is, for the tests of this config. */
  readonly contextOptions: JourneyContextOptions
  readonly test: {
    name: 'journeys'
    include: string[]
    browser: { enabled: true; headless: true; provider: P; instances: { browser: 'webkit' }[] }
  }
}

/** A Vitest browser instance for the journeys: the engine, in the iPad context (what `defineTests`' `instance` takes). */
export interface JourneyInstance<P> {
  readonly browser: 'webkit' | 'chromium' | 'firefox'
  readonly provider: P
}

/**
 * The instance the journeys run as, from the config's `playwright`: `instance: journeyInstance(playwright)` on a
 * `defineTests` browser project. WebKit is the engine the journeys exist for; another engine runs the same context.
 */
export function journeyInstance<P>(
  provider: ProviderFactory<P>,
): (browser: JourneyInstance<P>['browser']) => JourneyInstance<P> {
  return (browser) => ({ browser, provider: provider({ contextOptions }) })
}

export function journeyProject<P>(
  provider: ProviderFactory<P>,
  options: JourneyProjectOptions = {},
): JourneyProject<P> {
  return {
    extends: true,
    // Svelte's client build, as the layout projects use.
    resolve: { conditions: ['browser'] },
    contextOptions,
    test: {
      name: 'journeys',
      include: [...(options.include ?? ['src/**/*.journey.test.ts'])],
      browser: {
        enabled: true,
        headless: true,
        provider: provider({ contextOptions }),
        instances: [{ browser: 'webkit' }],
      },
    },
  }
}
