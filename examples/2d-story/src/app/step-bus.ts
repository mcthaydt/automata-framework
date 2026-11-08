import type { BusPort } from '@automata/debug'
import type { StepResult } from '@automata/sim'

// The debug overlay's Watch hears the game through the presentation bus's `sim.step` fact (the tick and the events it made).
// A game with a core level has no renderer of its own to take the bus, only a `setup` that is told each step, so the story
// makes that one fact itself from the same step results. It reads them and never writes the sim.

/** A bus that knows one fact, `sim.step`, and tells it whenever `apply` is given a step. */
export function stepBus(): BusPort & { apply(result: StepResult): void } {
  const listeners = new Set<(fact: unknown) => void>()
  return {
    subscribe(name, listener) {
      if (name !== 'sim.step') return () => {}
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    apply(result) {
      if (listeners.size === 0) return
      const fact = { tick: result.tick, events: result.events }
      for (const listener of listeners) listener(fact)
    },
  }
}
