// base-3d's words, live (as the default screens' copy is kept): the HUD and the
// Items screen read `liveCopy.current` in their markup, and a screen that is open follows the runtime's `Locale`, so
// a language change re-renders the words in place with no remount.
import { BASE3D_COPY, type Base3dCopy, base3dCopy } from './copy.ts'

/** The parts of the runtime's `Locale` the copy reads. */
export interface LocaleReader {
  readonly current: string
  subscribe(listener: (locale: string) => void): () => void
}

class LiveCopy {
  current = $state<Base3dCopy>(BASE3D_COPY.en)
}

/** The game's words in the current locale. */
export const liveCopy: LiveCopy = new LiveCopy()

/** Keeps `liveCopy` in `locale`'s language until the returned stop is called. */
export function followLocale(locale: LocaleReader, table: typeof BASE3D_COPY = BASE3D_COPY): () => void {
  // `subscribe` calls at once with the current locale, then on each change.
  return locale.subscribe((current) => {
    liveCopy.current = base3dCopy(current, table)
  })
}
