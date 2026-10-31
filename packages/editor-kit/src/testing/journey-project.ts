// The `journeys` Vitest project every editor package spreads into its config (plan EDK.6b decision 1), so the 2D, 3D
// and suite lanes run their iPad journeys the same way: WebKit, in a context with touch, a 2× screen and Safari's iPad
// user agent, over the package's `*.journey.test.ts` files. The config hands it `playwright` from
// `@vitest/browser-playwright`, so this module never loads the provider itself and stays importable anywhere.

/** Safari on an iPad running iPadOS 18, as the user agent the journeys' pages see. */
export const IPAD_USER_AGENT =
  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const contextOptions = {
  hasTouch: true,
  deviceScaleFactor: 2,
  userAgent: IPAD_USER_AGENT,
  viewport: { width: 1194, height: 834 },
}

/** `playwright` from `@vitest/browser-playwright`, or a stand-in in a test. */
export type ProviderFactory<P> = (options: { readonly contextOptions: typeof contextOptions }) => P

export interface JourneyProjectOptions {
  /** The journey files; `src/**\/*.journey.test.ts` by default. */
  readonly include?: readonly string[]
}

export function journeyProject<P>(provider: ProviderFactory<P>, options: JourneyProjectOptions = {}) {
  return {
    extends: true as const,
    // Svelte's client build, as the layout projects use.
    resolve: { conditions: ['browser'] },
    /** What the iPad context is, for the tests of this config. */
    contextOptions,
    test: {
      name: 'journeys',
      include: [...(options.include ?? ['src/**/*.journey.test.ts'])],
      browser: {
        enabled: true,
        headless: true,
        provider: provider({ contextOptions }),
        instances: [{ browser: 'webkit' as const }],
      },
    },
  }
}
