import type { OpeningContext, OpeningStep } from '@automataframework/framework'
import { mount, unmount } from 'svelte'
import SplashScreen from '../features/splash/SplashScreen.svelte'
import { type SplashCopy, screensWords } from '../shared/words/screens-words.ts'

export type { SplashCopy } from '../shared/words/screens-words.ts'

/** How a game sets up its splash. */
export interface SplashOptions {
  /** The studio's image, the game's own file, and the words a screen reader says for it. */
  readonly logo: { readonly src: string; readonly alt: string }
  /** How long the logo is held, in milliseconds, unless a press ends it first. Default 1500. */
  readonly holdMs?: number
  /** The line under the logo: fixed words, or words for a locale. Default: this package's words in the player's language. */
  readonly copy?: SplashCopy | ((locale: string) => SplashCopy)
}

const DEFAULT_HOLD_MS = 1500

/**
 * An opening step that shows the studio's logo, holds it for `holdMs` on the runtime's clock and ends early on any key,
 * click or tap. The runtime's `opening` list takes it after the first-run screens and before the first screen; it
 * runs once the host is ready, so it can never delay the host's ready signal. It plays no sound, and it resolves at
 * once when the runtime shuts down.
 */
export function splashStep(options: SplashOptions): OpeningStep {
  const holdMs = options.holdMs ?? DEFAULT_HOLD_MS
  return ({ layer, services, signal }: OpeningContext) => {
    if (signal.aborted) return Promise.resolve()
    const { clock, locale } = services
    const words =
      typeof options.copy === 'function'
        ? options.copy(locale.current)
        : (options.copy ?? screensWords(locale.current).splash)
    return new Promise<void>((resolve) => {
      let finished = false
      // The one way out: a press, the hold or a shutdown, whichever comes first, and only once.
      const finish = (): void => {
        if (finished) return
        finished = true
        clock.clearTimeout(timer)
        signal.removeEventListener('abort', finish)
        void unmount(screen)
        resolve()
      }
      const screen = mount(SplashScreen, {
        target: layer,
        props: { logo: options.logo, copy: words, onDone: finish },
      })
      const timer = clock.setTimeout(finish, holdMs)
      signal.addEventListener('abort', finish, { once: true })
    })
  }
}
