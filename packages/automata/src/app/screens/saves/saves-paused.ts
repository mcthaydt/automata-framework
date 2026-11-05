// What the default paused screen does with a game's save: the host's word
// on the progress, and the choice offered once another device has changed the slot being played.

import { Effect, type Scope, Stream } from 'effect'
import type { Save } from '../../../features/saves/save.manager.ts'
import { saveOf } from '../../../features/saves/saves.manager.ts'
import { Hosting } from '../../../shared/host/hosting.ts'
import type { SaveStatusState } from '../../../shared/ui/status/save-status.ts'
import { Saves } from '../../boot/effect-tags.ts'
import type { GameSaves } from '../../define-game.ts'
import { orDispose, orThrow, type SavesStart } from './saves-start.ts'
import { createPausedSavesView, type PausedSavesView } from './saves-view.svelte.ts'

/** What the paused screen needs to speak for a game's save. */
export interface PausedSaves {
  /** Changed in place by the screen's own streams. */
  readonly view: PausedSavesView
  /** Replace the game being played with what the other device wrote, and resume into it. */
  readonly onLoadNewer: () => void
  /** Carry on with this game: its next write replaces what the other device wrote. */
  readonly onKeepPlaying: () => void
}

/**
 * What to say about the host's saves. Standalone has nothing to sync, so nothing is said; under a host that did not
 * grant `saves`, nothing the game does is kept, and the player is told so rather than shown the SDK's in-memory state.
 */
export const statusOf = (
  hosting: Pick<Hosting, 'kind' | 'granted'>,
  status: SaveStatusState,
): SaveStatusState | undefined =>
  hosting.kind === 'standalone' ? undefined : hosting.granted.has('saves') ? status : 'no-grant'

/**
 * The paused screen's save line and choice, kept up to date for as long as the screen is open. `start.play` replaces
 * the sim with the newer progress and resumes into it.
 */
export function pausedSaves(
  saves: GameSaves<unknown>,
  start: SavesStart,
): Effect.Effect<PausedSaves, never, Saves | Hosting | Scope.Scope> {
  return Effect.gen(function* () {
    const save: Save<unknown> = saveOf(yield* Saves, saves.def)
    const hosting = yield* Hosting
    const view = createPausedSavesView()

    view.status = statusOf(hosting, yield* hosting.savesStatus.get)
    yield* Effect.forkScoped(
      Stream.runForEach(hosting.savesStatus.changes, (status) =>
        Effect.sync(() => {
          view.status = statusOf(hosting, status)
        }),
      ),
    )
    const stopChanged = save.changedElsewhere.subscribe((changed) => {
      view.changedElsewhere = changed
    })
    yield* Effect.addFinalizer(() => Effect.sync(stopChanged))

    let busy = false
    return {
      view,
      onLoadNewer: () => {
        if (busy) return
        busy = true
        view.loadFailed = false
        void (async () => {
          const loaded = await orThrow(save.loadNewer())
          const sim = await start.fresh()
          await orDispose(sim, () => saves.apply(sim, loaded.data))
          start.play(sim)
        })()
          .catch(() => {
            view.loadFailed = true
          })
          .finally(() => {
            busy = false
          })
      },
      onKeepPlaying: () => {
        view.loadFailed = false
        save.keepPlaying()
      },
    }
  })
}
