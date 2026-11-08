// Watch: an editor frames the game and asks, in the game's address, to hear which sim events happen (Schematic asks for
// `systems.mode`, to show which mode each character is in). The game answers by posting those events, and only those, to
// the window that framed it, and only to the origin the editor named; never to `*`. An unframed page, or an address that
// asks for nothing, listens to nothing. Nothing here touches the sim: it hears the presentation bus.
import type { BusPort } from '../../shared/host'

/** What the editor hears for each event. */
export interface ForwardedEvent {
  readonly type: 'af-sim-event'
  readonly name: string
  readonly payload: unknown
  /** The sim tick that emitted it, and that tick in seconds. */
  readonly tick: number
  readonly seconds: number
}

interface Step {
  readonly tick: number
  readonly events: readonly { readonly type: string; readonly payload: unknown }[]
}

const isStep = (fact: unknown): fact is Step =>
  typeof fact === 'object' &&
  fact !== null &&
  typeof (fact as Step).tick === 'number' &&
  Array.isArray((fact as Step).events)

/** The origin the address names, or `undefined` when it is not exactly an origin (`*`, `null` and paths are not). */
function originOf(text: string | null): string | undefined {
  if (text === null || !URL.canParse(text)) return undefined
  const { origin } = new URL(text)
  return origin !== 'null' && origin === text ? origin : undefined
}

/** Whether `parent` is another window: a page nothing framed is its own parent. */
const framed = (parent: Pick<Window, 'postMessage'>): boolean =>
  parent !== (globalThis as unknown) && parent !== (globalThis as { window?: unknown }).window

/**
 * Starts forwarding when the page is framed and its address carries `af-watch` (the editor's origin) and `events` (the
 * event names, comma between). Returns the stop; it returns at once, having listened to nothing, otherwise.
 */
export function forwardEvents(
  bus: BusPort,
  location: Pick<Location, 'search'>,
  parent: Pick<Window, 'postMessage'>,
  options: { readonly tickHz?: number } = {},
): () => void {
  const asked = new URLSearchParams(location.search)
  const origin = originOf(asked.get('af-watch'))
  const names = new Set(
    (asked.get('events') ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name !== ''),
  )
  if (origin === undefined || names.size === 0 || !framed(parent)) return () => {}
  const hz = options.tickHz ?? 60
  return bus.subscribe('sim.step', (fact) => {
    if (!isStep(fact)) return
    for (const event of fact.events) {
      if (!names.has(event.type)) continue
      const message: ForwardedEvent = {
        type: 'af-sim-event',
        name: event.type,
        payload: event.payload,
        tick: fact.tick,
        seconds: Math.round((fact.tick / hz) * 10) / 10,
      }
      parent.postMessage(message, origin)
    }
  })
}
