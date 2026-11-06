// The game's scores for sim events: sim events reach the leaderboards as presentation-bus facts,
// never the other way round, so a board can never change what the sim does. The score is the game's function of
// the event's payload, so it comes from sim state and is never typed by anyone (Ruken request R-80).
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import type { Leaderboards } from './leaderboards.manager.js'

/** A sim event's type (its `defineEvent` id) → the board it scores on and the score its payload gives. */
export type EventScores = Readonly<
  Record<string, { readonly board: string; readonly score: (payload: unknown) => number }>
>

/** Submits the mapped score for each sim event, once per event; returns the unsubscribe. */
export function submitEventScores(
  bus: PresentationBus,
  boards: Pick<Leaderboards, 'submitScore'>,
  scores: EventScores,
): () => void {
  const map = new Map(Object.entries(scores))
  return bus.subscribe('sim.events', (events) => {
    for (const event of events) {
      const entry = map.get(event.type)
      if (entry === undefined) continue
      // Fire and forget, as a sound is: the outcome is the board's state and its `leaderboard.submitted` fact.
      void boards.submitScore(entry.board, entry.score(event.payload))
    }
  })
}
