import type { RoundOutcome } from '@ruken/sdk'

export interface RoundReporter {
  start(): void
  end(outcome: RoundOutcome): void
}

/**
 * Ruken counts rounds for its play metrics, and a start without an end (or two
 * starts) would count a round that never happened. This keeps every caller
 * honest, whichever screen calls first: a second start before an end is
 * dropped, and so is an end with no round open.
 * From FloorFifty `apps/client/src/ruken/host.ts` `guardRounds`.
 */
export function guardRounds(round: RoundReporter): RoundReporter {
  let open = false
  return {
    start: () => {
      if (open) return
      open = true
      round.start()
    },
    end: (outcome) => {
      if (!open) return
      open = false
      round.end(outcome)
    },
  }
}
