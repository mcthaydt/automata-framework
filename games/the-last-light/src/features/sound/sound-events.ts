import type { SimEvent } from '@automata/sim'

// The audio file's rows answer an event by its type, and the sim's types do not say which cutscene started, which mode a
// figure entered, what kind of noise was made or which hotspot was used. Those carry the answer in their payload, so the game
// names them the way the old game's table did (`cutscene.<id>`, `agent.<who>.<mode>`, `noise.<kind>`, `use.<hotspot>`,
// `game.hide`) and the rows say what each plays. Pure: a name per event, never a write to the sim.

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

/** The name the audio rows know this event by, when its payload says more than its type does. */
function nameOf(event: SimEvent): string | undefined {
  const payload = (event.payload ?? {}) as Record<string, unknown>
  switch (event.type) {
    case 'cutscene.started': {
      const id = text(payload.id)
      return id === undefined ? undefined : `cutscene.${id}`
    }
    case 'systems.mode': {
      const agent = text(payload.agent)
      const to = text(payload.to)
      return agent === undefined || to === undefined ? undefined : `agent.${agent}.${to}`
    }
    case 'systems.noise':
    case 'puzzle.noise': {
      const kind = text(payload.kind)
      return kind === undefined ? undefined : `noise.${kind}`
    }
    case 'puzzle.said': {
      const at = text(payload.at)
      return at === undefined ? undefined : `use.${at}`
    }
    case 'interact.used':
      return payload.hid === true ? 'game.hide' : undefined
    default:
      return undefined
  }
}

/**
 * The events the audio rows hear beside the sim's own: one named event for each that has a name, in the order they happened,
 * carrying the original's payload (so a noise still says where it was made).
 */
export function soundEventsOf(events: readonly SimEvent[]): SimEvent[] {
  return events.flatMap((event) => {
    const type = nameOf(event)
    return type === undefined ? [] : [{ ...event, type } as SimEvent]
  })
}
