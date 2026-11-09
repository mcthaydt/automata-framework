// The bus panel's record: the last facts heard on the presentation bus, each as a name and one line of text. It only listens.
import type { BusPort } from './host'

/** One fact heard on the presentation bus: its name and one line of text. */
export interface FactEntry {
  readonly name: string
  readonly text: string
}
/**
 * The bus panel's record of the last facts heard. Read it with `entries`, hear changes with
 * `subscribe` and stop listening with `dispose`.
 */
export interface FactLog {
  entries(): readonly FactEntry[]
  subscribe(listener: () => void): () => void
  dispose(): void
}

/** The facts the runtime publishes (core's `RuntimeFacts`), for a host that does not name its own. */
export const RUNTIME_FACTS: readonly string[] = [
  'sim.events',
  'screen.entered',
  'time.changed',
  'locale.changed',
  'input.device.changed',
  'audio.unlocked',
  'audio.unavailable',
  'audio.decode.failed',
  'input.pad.connected',
  'input.pad.disconnected',
  'input.bindings.changed',
  'render.filter.dropped',
  'render.context.lost',
  'render.context.restored',
  'save.written',
  'save.failed',
  'save.loaded',
  'save.changedElsewhere',
  'leaderboard.submitted',
]

const LINE = 200
const text = (fact: unknown): string => {
  try {
    return (JSON.stringify(fact) ?? String(fact)).slice(0, LINE)
  } catch {
    return '[unprintable]'
  }
}

/**
 * Starts listening for the named facts on the bus and keeps the last `limit` of them (50 by
 * default). It only listens: it never sends anything.
 */
export function recordFacts(bus: BusPort, names: readonly string[], limit = 50): FactLog {
  let entries: FactEntry[] = []
  const listeners = new Set<() => void>()
  const offs = names.map((name) =>
    bus.subscribe(name, (fact) => {
      entries = [...entries, { name, text: text(fact) }].slice(-limit)
      for (const listener of [...listeners]) listener()
    }),
  )
  return {
    entries: () => entries,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      for (const off of offs) off()
    },
  }
}
