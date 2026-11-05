// The default screens' words, live: resolved in the player's locale, and again on each change, for as long as
// the screen that asked is open. A screen reads `copy.current` in its markup, so a change re-renders the words in
// place: no remount, focus kept.
import type { Disposables } from '../../shared/lib/disposables.ts'
import { resolveScreensCopy, type ScreensCopy, type ScreensCopyInput } from './screens-copy.ts'

/** The parts of the runtime's `Locale` the copy reads. */
export interface LocaleReader {
  readonly current: string
  subscribe(listener: (locale: string) => void): () => void
}

/** The screens' words, kept in the current locale. */
export interface LiveScreensCopy {
  readonly current: ScreensCopy
}

class Holder implements LiveScreensCopy {
  current = $state<ScreensCopy>() as ScreensCopy
}

/** The screens' words in `locale`, kept up to date until `owner` is disposed. */
export function screensCopy(
  owner: Disposables,
  input: ScreensCopyInput | undefined,
  locale: LocaleReader,
): LiveScreensCopy {
  const holder = new Holder()
  holder.current = resolveScreensCopy(input, locale.current)
  // `subscribe` calls at once with the current locale, then on each change.
  owner.add(
    locale.subscribe((current) => {
      holder.current = resolveScreensCopy(input, current)
    }),
  )
  return holder
}
