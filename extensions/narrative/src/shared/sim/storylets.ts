// Storylets, as pure functions over what a deck
// has played; the sim keeps that in a resource and calls these on a verb, on each step and on a system event.
//
// Salience: of the storylets a trigger fires whose `when` holds and that may play again (`once`, `max`), the one with
// the most conditions wins, then the higher priority, then the earlier in the deck. Each play says the storylet's next
// line, in turn. An inspect storylet that follows an action's own line (or a turn away to a cutscene, dialogue, keypad
// or exit) waits AFTER seconds; while one waits, nothing else plays, and the next verb drops it. Dwell counts
// seconds standing still in the room; moving or a verb resets it.
import { holds as condHolds, type Reader } from '@automata/puzzle/sim'
import { parseTrigger, type Storylet, type Trigger } from './storylet.schema'

/** The least time an action's own line stays up before a storylet follows it, in seconds. */
export const AFTER = 2
/** Float slack when comparing accumulated seconds with a threshold, as in the original. */
const EPSILON = 1e-9

/** Where the player stands: the sector's id and its zone. */
export interface Room {
  readonly sector: string
  readonly zone: string
}
export interface StoryletState {
  /** Plays so far, by storylet. */
  readonly played: Readonly<Record<string, number>>
  /** Seconds standing still while a dwell storylet could play, or null. */
  readonly still: number | null
  /** An inspect storylet waiting for the action's line: it plays on step `at`. */
  readonly queued: { readonly id: string; readonly at: number } | null
  /** The room last step, to see an entry. */
  readonly room: Room | null
}
/** One play: the storylet and the line id it says. */
export interface Play {
  readonly id: string
  readonly line: string
}
export interface Outcome {
  readonly state: StoryletState
  readonly plays: readonly Play[]
}
/** A verb as puzzle's `verb` hook reports it. */
export interface HeardVerb {
  readonly at: string
  readonly held: string | undefined
  readonly said: boolean
  readonly away: boolean
}
/** The player this step. */
export interface Here {
  readonly room: Room | null
  readonly moving: boolean
}

export const freshStorylets = (): StoryletState => ({ played: {}, still: null, queued: null, room: null })

const playedOf = (state: StoryletState, id: string): number => state.played[id] ?? 0

/** The reader a deck's `when` uses: `played.<id>`, then the base (dialogue, deck facts, puzzle). */
export function storyletReader(state: StoryletState, base: Reader): Reader {
  return {
    fact: (name) => (name.startsWith('played.') ? playedOf(state, name.slice(7)) : base.fact(name)),
    has: base.has,
  }
}

/** Whether a storylet may play again: its `once` and `max`. */
export function fresh(state: StoryletState, s: Storylet): boolean {
  const n = playedOf(state, s.id)
  return !(s.once === true && n >= 1) && !(s.max !== undefined && n >= s.max)
}

/** The most salient storylet a trigger fires, or null. */
export function select(
  deck: readonly Storylet[],
  state: StoryletState,
  base: Reader,
  fired: (t: Trigger) => boolean,
): Storylet | null {
  const r = storyletReader(state, base)
  let best: Storylet | null = null
  let conditions = -1
  let priority = 0
  for (const s of deck) {
    const t = parseTrigger(s.trigger)
    const when = s.when ?? []
    if (t === null || !fired(t) || !fresh(state, s) || !when.every((c) => condHolds(r, { at: '' }, c)))
      continue
    const p = s.priority ?? 0
    if (best === null || when.length > conditions || (when.length === conditions && p > priority)) {
      best = s
      conditions = when.length
      priority = p
    }
  }
  return best
}

/** A storylet played: its next line, counted. */
export function play(state: StoryletState, s: Storylet): Outcome {
  const n = playedOf(state, s.id)
  const line = s.lines[n % s.lines.length] as string
  return { state: { ...state, played: { ...state.played, [s.id]: n + 1 } }, plays: [{ id: s.id, line }] }
}

const none = (state: StoryletState): Outcome => ({ state, plays: [] })

/**
 * After a verb: whatever waited is dropped and the dwell clock restarts; then a bare-hand verb at a hotspot fires its
 * inspect storylet, at once when the action said nothing and did not turn away, else AFTER seconds on.
 */
export function onVerb(
  deck: readonly Storylet[],
  state: StoryletState,
  verb: HeardVerb,
  at: { readonly tick: number; readonly dt: number },
  base: Reader,
): Outcome {
  if (deck.length === 0) return none(state)
  const dropped: StoryletState = { ...state, queued: null, still: null }
  if (verb.held !== undefined || verb.at === 'floor' || verb.at === 'combine') return none(dropped)
  const s = select(deck, dropped, base, (t) => t.kind === 'inspect' && t.target === verb.at)
  if (s === null) return none(dropped)
  if (!verb.said && !verb.away) return play(dropped, s)
  return none({ ...dropped, queued: { id: s.id, at: at.tick + Math.round(AFTER / at.dt) } })
}

const inRoom = (t: Trigger, room: Room): boolean => t.target === room.zone || t.target === room.sector

/**
 * A step: a waiting storylet plays when its step comes; while one waits nothing else does. Then an entry into a new
 * zone or sector fires `enter`; otherwise standing still counts towards `dwell`.
 */
export function onStep(
  deck: readonly Storylet[],
  state: StoryletState,
  here: Here,
  at: { readonly tick: number; readonly dt: number },
  base: Reader,
): Outcome {
  if (deck.length === 0) return none(state)
  const before = state.room
  const plays: Play[] = []
  let now: StoryletState = { ...state, room: here.room }
  const queued = now.queued
  if (queued !== null && at.tick >= queued.at) {
    now = { ...now, queued: null }
    const s = deck.find((x) => x.id === queued.id)
    if (s !== undefined) {
      const played = play(now, s)
      now = played.state
      plays.push(...played.plays)
    }
  }
  const room = here.room
  if (now.queued !== null || room === null)
    return { state: room === null ? { ...now, still: null } : now, plays }
  if (before !== null) {
    const zone = room.zone !== before.zone
    const sector = room.sector !== before.sector
    const s = select(
      deck,
      now,
      base,
      (t) => t.kind === 'enter' && ((zone && t.target === room.zone) || (sector && t.target === room.sector)),
    )
    if (s !== null) {
      const played = play(now, s)
      return { state: played.state, plays: [...plays, ...played.plays] }
    }
  }
  const waiting = here.moving ? [] : deck.filter((s) => dwellIn(s, room) !== null)
  if (waiting.length === 0 || select(waiting, now, base, () => true) === null)
    return { state: { ...now, still: null }, plays }
  const still = (now.still ?? 0) + at.dt
  const ready = select(
    deck,
    now,
    base,
    (t) => t.kind === 'dwell' && inRoom(t, room) && t.seconds <= still + EPSILON,
  )
  if (ready !== null) {
    const played = play({ ...now, still: 0 }, ready)
    return { state: played.state, plays: [...plays, ...played.plays] }
  }
  const longest = waiting.reduce((m, s) => Math.max(m, (dwellIn(s, room) as number) ?? 0), 0)
  return { state: { ...now, still: Math.min(still, longest) }, plays }
}

/** A dwell storylet's seconds when it is for this room, else null. */
function dwellIn(s: Storylet, room: Room): number | null {
  const t = parseTrigger(s.trigger)
  return t !== null && t.kind === 'dwell' && inRoom(t, room) ? t.seconds : null
}

/** A system event (the game's own, by name): its storylet plays at once, unless one is waiting. */
export function onSystem(
  deck: readonly Storylet[],
  state: StoryletState,
  event: string,
  base: Reader,
): Outcome {
  if (deck.length === 0 || state.queued !== null) return none(state)
  const s = select(deck, state, base, (t) => t.kind === 'system' && t.target === event)
  return s === null ? none(state) : play(state, s)
}
