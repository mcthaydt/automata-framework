import { mount, unmount } from 'svelte'
import { disposables } from '../../shared/lib/disposables.ts'
import { screensCopy } from '../screens/screens-copy.svelte.ts'
import type { ScreensCopyInput } from '../screens/screens-copy.ts'
import LanguageFirst from './LanguageFirst.svelte'
import type { OpeningStep } from './opening.ts'
import { type PhotosensitivityOption, warningStep } from './photosensitivity.ts'

// The first run: what a device that has never opened the game shows before anything else. Language comes first; the
// warning (a game that flashes) follows, then the game's own opening steps.

/** What the first run reads of a game. */
export interface FirstRunGame {
  /** The first run asks for a language when the game has more than one. Default true; false never shows the screen. */
  readonly firstRunLanguage?: boolean | undefined
  /** The game flashes: the first run warns once per device, after the language. Absent: no warning. */
  readonly photosensitivity?: PhotosensitivityOption | undefined
  /** The game's own words for the default screens, which the first run's screens read as the others do. */
  readonly copy?: ScreensCopyInput | undefined
}

/**
 * Asks which language to use. It resolves at once, showing nothing, unless the game ships more than one language, the
 * host is not Ruken (which supplies the language), the player has not chosen one and this device has not shown it
 * before. One press picks a language and goes on; Close and Escape go on with the language the device suggested, and
 * the screen never comes back.
 */
export function languageStep(copy?: ScreensCopyInput): OpeningStep {
  return ({ layer, services, seen, signal }) => {
    const { locale, hosting } = services
    if (locale.locales.length < 2 || hosting.kind === 'ruken') return Promise.resolve()
    if (locale.choice !== null || seen.has('language')) return Promise.resolve()
    return new Promise<void>((resolve) => {
      const owner = disposables()
      const words = screensCopy(owner, copy, locale)
      let finished = false
      const finish = (): void => {
        if (finished) return
        finished = true
        signal.removeEventListener('abort', finish)
        owner.dispose()
        resolve()
      }
      const screen = mount(LanguageFirst, {
        target: layer,
        props: {
          locales: locale.locales,
          detected: locale.current,
          copy: words,
          onpick: (tag: string) => {
            locale.set(tag)
            seen.mark('language')
            finish()
          },
          onclose: () => {
            seen.mark('language')
            finish()
          },
        },
      })
      owner.add(() => void unmount(screen))
      if (signal.aborted) finish()
      else signal.addEventListener('abort', finish, { once: true })
    })
  }
}

/** The steps the first run adds before a game's own opening. */
export function firstRunSteps(game: FirstRunGame): OpeningStep[] {
  const steps: OpeningStep[] = []
  if (game.firstRunLanguage !== false) steps.push(languageStep(game.copy))
  if (game.photosensitivity !== undefined) steps.push(warningStep(game.photosensitivity, game.copy))
  return steps
}
