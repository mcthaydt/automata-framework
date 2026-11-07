// The default screens' words, live (DX.2d): resolved in the player's locale, and again on each change, for as long as
// the screen that asked is open. A screen reads `copy.current` in its markup, so a change re-renders the words in
// place: no remount, focus kept (PRODUCT spec §4, L-c).
import { Effect, type Scope } from 'effect'
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

export function screensCopy(
  input: ScreensCopyInput | undefined,
  locale: LocaleReader,
): Effect.Effect<LiveScreensCopy, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const holder = new Holder()
      holder.current = resolveScreensCopy(input, locale.current)
      // `subscribe` calls at once with the current locale, then on each change.
      const stop = locale.subscribe((current) => {
        holder.current = resolveScreensCopy(input, current)
      })
      return { holder, stop }
    }),
    ({ stop }) => Effect.sync(stop),
  ).pipe(Effect.map(({ holder }) => holder))
}
