import { mount, unmount } from 'svelte'
import { disposables } from '../../shared/lib/disposables.ts'
import { reducedMotion } from '../../shared/ui/browser/reduced-motion.ts'
import { screensCopy } from '../screens/screens-copy.svelte.ts'
import type { ScreensCopyInput } from '../screens/screens-copy.ts'
import type { OpeningStep } from './opening.ts'
import PhotosensitivityWarning from './PhotosensitivityWarning.svelte'
import type { WarningEffect } from './warning-effects.ts'

// The flashing-lights warning: a game that flashes opts in with `defineGame({ photosensitivity })`, and the first run
// on a device warns once, before anything plays.

/**
 * A switch the warning offers: one of the game's own effect settings. A switch is on or off, so a setting with more
 * steps is mapped: `@automataframework/feel`'s `intensity` is `0 | 0.5 | 1`, so a "Less shaking" switch maps on to `0.5` and off
 * to `1`; its `reduceFlashing` maps straight across. Core cannot import feel, so the game passes its own.
 */
export interface WarningSwitch {
  /** Names the switch in tests and for the list's keys; unique among a game's switches. */
  readonly id: string
  /** What the switch is called, or a function of the player's language (it runs again on a language change). */
  readonly label: string | ((locale: string) => string)
  /** Whether the effect is turned down now. */
  get(): boolean
  /** Turns the effect down (`true`) or back up. Called the moment the player flips the switch. */
  set(on: boolean): void
}

/**
 * `true`: the warning, with the device's reduced-motion line. An object adds what the game has, as data: `effects`
 * names each hazard (`'flashing'`, `'strobing'`, `'shaking'`, `'patterns'`) and the warning says them in the player's
 * language ("This game has flashing lights and a shaking screen."); a game that declares none gets the general sentence
 * ("This game may have flashing lights or a shaking screen."). `switches` are the game's own effect settings, shown
 * above the device's reduced-motion line.
 */
export type PhotosensitivityOption =
  | true
  | { readonly effects?: readonly WarningEffect[]; readonly switches?: readonly WarningSwitch[] }

/**
 * Warns about flashing lights, once per device. Continue, Close and Escape all end it, and the switches keep what the
 * player set. It resolves at once, showing nothing, on a device that has already shown it. The words are the default
 * screens' (`copy.screens` overrides them) and read in the language the player has just picked.
 */
export function warningStep(option: PhotosensitivityOption, copy?: ScreensCopyInput): OpeningStep {
  const switches = option === true ? [] : (option.switches ?? [])
  const effects = option === true ? [] : (option.effects ?? [])
  return ({ layer, services, seen, signal }) => {
    if (seen.has('photosensitivity')) return Promise.resolve()
    return new Promise<void>((resolve) => {
      const owner = disposables()
      const words = screensCopy(owner, copy, services.locale)
      let finished = false
      const finish = (): void => {
        if (finished) return
        finished = true
        signal.removeEventListener('abort', finish)
        owner.dispose()
        resolve()
      }
      // Only the player ends the warning for good: a shutdown that aborts it leaves it for the next run.
      const acknowledge = (): void => {
        seen.mark('photosensitivity')
        finish()
      }
      const screen = mount(PhotosensitivityWarning, {
        target: layer,
        props: {
          copy: words,
          locale: services.locale,
          switches,
          effects,
          reducedMotion: reducedMotion(),
          ondone: acknowledge,
        },
      })
      owner.add(() => void unmount(screen))
      if (signal.aborted) finish()
      else signal.addEventListener('abort', finish, { once: true })
    })
  }
}
