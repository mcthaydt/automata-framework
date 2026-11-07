// Storylets (M6 spec §4.13): the adventure source's salience, once and max, inspect, enter, dwell, system and state
// cases, re-pointed at the pure functions (a room is a sector id or a zone, NR-D5; an inspect waits AFTER, NR-D4).
import type { Reader, Value } from '@automata/puzzle/sim'
import { describe, expect, it } from 'vitest'
import {
  freshStorylets,
  onStep,
  onSystem,
  onVerb,
  type Room,
  type Storylet,
  type StoryletState,
  select,
  storyletReader,
} from './index'

const DT = 1 / 60
const HALL: Room = { sector: 'hall-1', zone: 'Reception' }
const WARD: Room = { sector: 'ward', zone: 'Ward' }
const s = (id: string, trigger: string, lines: string[], extra: Partial<Storylet> = {}): Storylet => ({
  id,
  trigger,
  lines,
  ...extra,
})

/** A game's facts and items as puzzle's reader. */
function world(): { facts: Record<string, Value>; items: string[]; reader: Reader } {
  const facts: Record<string, Value> = {}
  const items: string[] = []
  return { facts, items, reader: { fact: (name) => facts[name], has: (item) => items.includes(item) } }
}

/** A deck run through verbs and steps, collecting the lines it plays. */
function harness(deck: Storylet[]) {
  const w = world()
  let state: StoryletState = freshStorylets()
  let tick = 0
  const lines: string[] = []
  const take = (out: { state: StoryletState; plays: readonly { line: string }[] }): void => {
    state = out.state
    lines.push(...out.plays.map((p) => p.line))
  }
  return {
    w,
    lines,
    state: () => state,
    verb: (at: string, said = false, extra: { held?: string; away?: boolean } = {}) =>
      take(
        onVerb(
          deck,
          state,
          { at, held: extra.held, said, away: extra.away ?? false },
          { tick, dt: DT },
          w.reader,
        ),
      ),
    step: (room: Room | null, moving: boolean, seconds: number) => {
      for (let t = 0; t < seconds - 1e-9; t += DT) {
        tick += 1
        take(onStep(deck, state, { room, moving }, { tick, dt: DT }, w.reader))
      }
    },
    system: (event: string) => take(onSystem(deck, state, event, w.reader)),
  }
}

describe('salience', () => {
  const deck = [
    s('st.generic', 'inspect:clock', ['t.a']),
    s('st.one', 'inspect:clock', ['t.b'], { when: [{ fact: 'power', is: true }] }),
    s('st.two', 'inspect:clock', ['t.c'], { when: [{ fact: 'power', is: true }, { has: 'lighter' }] }),
    s('st.twoHigh', 'inspect:clock', ['t.d'], {
      when: [
        { fact: 'power', is: true },
        { fact: 'fuel', atLeast: 5 },
      ],
      priority: 1,
    }),
  ]
  const fired = (t: { kind: string; target: string }): boolean => t.kind === 'inspect' && t.target === 'clock'

  it('the most conditions win, then priority, then deck order', () => {
    const w = world()
    const state = freshStorylets()
    w.facts.fuel = 0
    expect(select(deck, state, w.reader, fired)?.id).toBe('st.generic')
    w.facts.power = true
    expect(select(deck, state, w.reader, fired)?.id).toBe('st.one')
    w.items.push('lighter')
    w.facts.fuel = 10
    expect(select(deck, state, w.reader, fired)?.id).toBe('st.twoHigh')
    const tied = [deck[2] as Storylet, { ...(deck[3] as Storylet), priority: 0 }]
    expect(select(tied, state, w.reader, fired)?.id).toBe('st.two')
  })

  it('reads played.<storylet> over the base', () => {
    const w = world()
    w.facts.far = true
    const r = storyletReader({ ...freshStorylets(), played: { 'st.one': 2 } }, w.reader)
    expect([r.fact('played.st.one'), r.fact('played.st.two'), r.fact('far')]).toEqual([2, 0, true])
  })
})

describe('once and max', () => {
  it('a once storylet plays once; a max one that many times, each play the next line', () => {
    const h = harness([
      s('st.once', 'inspect:clock', ['t.a'], { once: true }),
      s('st.twice', 'inspect:radio', ['t.b', 't.c'], { max: 2 }),
    ])
    for (let i = 0; i < 3; i++) {
      h.verb('clock')
      h.verb('radio')
    }
    expect(h.lines).toEqual(['t.a', 't.b', 't.c'])
    expect(h.state().played).toEqual({ 'st.once': 1, 'st.twice': 2 })
  })
})

describe('inspect', () => {
  it('plays AFTER seconds after the action’s own line, or after a turn away', () => {
    const h = harness([s('st.bed', 'inspect:bed', ['t.a'], { max: 2 })])
    h.verb('bed', true)
    expect(h.lines).toEqual([])
    h.step(HALL, false, 1.9)
    expect(h.lines).toEqual([])
    h.step(HALL, false, 0.2)
    expect(h.lines).toEqual(['t.a'])
    h.verb('bed', false, { away: true })
    h.step(HALL, false, 2.1)
    expect(h.lines).toEqual(['t.a', 't.a'])
  })

  it('plays at once when the action says nothing, and not on a use with an item or at the floor', () => {
    const h = harness([
      s('st.clock', 'inspect:clock', ['t.a'], { max: 9 }),
      s('st.floor', 'inspect:floor', ['t.b']),
    ])
    h.verb('clock', false, { held: 'lighter' })
    h.verb('floor')
    expect(h.lines).toEqual([])
    h.verb('clock')
    expect(h.lines).toEqual(['t.a'])
  })

  it('a new action drops what is queued, which can play again later', () => {
    const h = harness([s('st.bed', 'inspect:bed', ['t.a'], { once: true })])
    h.verb('bed', true)
    h.verb('clock')
    h.step(HALL, false, 10)
    expect(h.lines).toEqual([])
    h.verb('bed', true)
    h.step(HALL, false, 10)
    expect(h.lines).toEqual(['t.a'])
  })
})

describe('enter', () => {
  it('fires once per entry, by zone or sector id', () => {
    const h = harness([
      s('st.ward', 'enter:ward', ['t.a'], { max: 9 }),
      s('st.hall', 'enter:Reception', ['t.b'], { max: 9, when: [{ fact: 'power', is: true }] }),
    ])
    h.step(HALL, true, 0.5)
    h.step(WARD, true, 0.5)
    expect(h.lines).toEqual(['t.a'])
    h.step(WARD, false, 3)
    expect(h.lines).toEqual(['t.a'])
    h.w.facts.power = true
    h.step(HALL, true, 0.5)
    h.step(WARD, true, 0.5)
    expect(h.lines).toEqual(['t.a', 't.b', 't.a'])
  })
})

describe('dwell', () => {
  it('counts standing still in the room, and moving resets it', () => {
    const h = harness([s('st.wait', 'dwell:Reception:4', ['t.a'], { max: 2 })])
    h.step(HALL, false, 3)
    h.step(HALL, true, DT)
    h.step(HALL, false, 3)
    expect(h.lines).toEqual([])
    h.step(HALL, false, 1.1)
    expect(h.lines).toEqual(['t.a'])
    h.step(HALL, false, 4.1)
    expect(h.lines).toEqual(['t.a', 't.a'])
    h.step(HALL, false, 30)
    expect(h.lines).toHaveLength(2)
    expect(h.state().still).toBeNull()
  })

  it('a dwell elsewhere, or one whose conditions fail, counts nothing', () => {
    const h = harness([
      s('st.ward', 'dwell:ward:2', ['t.a']),
      s('st.hall', 'dwell:Reception:2', ['t.b'], { when: [{ fact: 'power', is: true }] }),
    ])
    h.step(HALL, false, 5)
    expect(h.lines).toEqual([])
    expect(h.state()).toEqual({ ...freshStorylets(), room: HALL })
  })
})

describe('system events', () => {
  it('plays the event’s storylet at once, but not while an inspect waits', () => {
    const h = harness([
      s('st.lit', 'system:light.on', ['t.a'], { max: 3 }),
      s('st.bed', 'inspect:bed', ['t.b']),
    ])
    h.system('light.on')
    expect(h.lines).toEqual(['t.a'])
    h.verb('bed', true)
    h.system('light.on')
    expect(h.lines).toEqual(['t.a'])
  })
})

describe('state', () => {
  it('an empty deck leaves the state as it was', () => {
    const state = freshStorylets()
    const w = world()
    expect(
      onVerb(
        [],
        state,
        { at: 'bed', held: undefined, said: false, away: false },
        { tick: 1, dt: DT },
        w.reader,
      ).state,
    ).toBe(state)
    expect(onStep([], state, { room: HALL, moving: false }, { tick: 1, dt: DT }, w.reader).state).toBe(state)
    expect(onSystem([], state, 'light.on', w.reader).state).toBe(state)
  })
})
