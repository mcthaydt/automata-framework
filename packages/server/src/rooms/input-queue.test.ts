import { describe, expect, it } from 'vitest'
import { InputQueue, MAX_QUEUED_COMMANDS, type QueuedInput } from './input-queue'

// FloorFifty `tests/server/rooms/input-queue.test.ts` (11 cases), generic over the sim's `Command`, plus SV-b (M7
// spec §13) and the seat-as-source rule (§4.3). `nextTick` is the tick the room steps next: the sim's `tick` before
// `step`. FloorFifty passed the tick it had last stepped, one less, with the same bounds.

const SEAT = 0
const LEAD = 60
const GAP = 1_800

const queue = (): InputQueue => new InputQueue({ maxLeadTicks: LEAD, maxSequenceGap: GAP })
const input = (seq: number, tick: number, payload: unknown = { right: true }): QueuedInput => ({
  seq,
  tick,
  type: 'move',
  payload,
})

describe('the input queue', () => {
  it('holds a command until the tick it was stamped for', () => {
    const q = queue()
    expect(q.submit(SEAT, input(1, 104), 101)).toEqual({ ok: true, tick: 104, slack: 3 })

    expect(q.take(101)).toEqual([])
    expect(q.take(103)).toEqual([])
    expect(q.take(104)).toEqual([{ tick: 104, source: SEAT, seq: 1, type: 'move', payload: { right: true } }])
  })

  it('delivers each command once, on its own tick', () => {
    // FloorFifty held the newest frame in force on every later tick. An AF command is an edge: the intent it sets
    // lives in the sim's state, and the replay records exactly what `step` received.
    const q = queue()
    q.submit(SEAT, input(1, 101), 101)
    q.submit(SEAT, input(2, 105, { left: true }), 101)

    expect(q.take(101).map((command) => command.seq)).toEqual([1])
    expect(q.take(104)).toEqual([])
    expect(q.take(105)).toMatchObject([{ seq: 2, payload: { left: true } }])
    expect(q.take(200)).toEqual([])
  })

  it('applies a late command on the next tick the room steps, and says how late', () => {
    const q = queue()
    expect(q.submit(SEAT, input(1, 96), 101)).toEqual({ ok: true, tick: 101, slack: -5 })
    expect(q.take(101)).toMatchObject([{ seq: 1, tick: 101 }])
  })

  it('delivers every command of a burst, in sequence order', () => {
    // A stall delivers a burst. FloorFifty kept the newest frame and carried a reset press from among them; here
    // nothing is collapsed, so no press can be swallowed.
    const q = queue()
    q.submit(SEAT, input(1, 97, { reset: true }), 101)
    q.submit(SEAT, input(2, 98), 101)

    expect(q.take(101)).toEqual([
      { tick: 101, source: SEAT, seq: 1, type: 'move', payload: { reset: true } },
      { tick: 101, source: SEAT, seq: 2, type: 'move', payload: { right: true } },
    ])
    expect(q.take(102)).toEqual([])
  })

  it('refuses a sequence that does not move forward', () => {
    const q = queue()
    q.submit(SEAT, input(5, 102), 101)
    expect(q.submit(SEAT, input(5, 103), 101)).toEqual({ ok: false, reason: 'sequence' })
    expect(q.submit(SEAT, input(3, 103), 101)).toEqual({ ok: false, reason: 'sequence' })
  })

  it('refuses a sequence that jumps beyond the window', () => {
    const q = queue()
    expect(q.submit(SEAT, input(GAP + 5, 102), 101)).toEqual({ ok: false, reason: 'sequence' })
    // The first sequence may be 0 (the wire's `seq` is a uint).
    expect(q.submit(SEAT, input(0, 102), 101).ok).toBe(true)
    expect(q.submit(SEAT, input(GAP, 102), 101).ok).toBe(true)
  })

  it('refuses a command stamped further ahead than any link needs', () => {
    const q = queue()
    expect(q.submit(SEAT, input(1, 101 + LEAD), 101)).toEqual({ ok: false, reason: 'lead' })
    expect(q.submit(SEAT, input(1, 101 + LEAD - 1), 101).ok).toBe(true)
  })

  it('never lets a later sequence take effect before an earlier one', () => {
    // A command stamped behind its predecessor takes effect with it, not before it: sequence order is intent order.
    const q = queue()
    q.submit(SEAT, input(1, 110), 101)
    expect(q.submit(SEAT, input(2, 105, { left: true }), 101)).toEqual({ ok: true, tick: 110, slack: 4 })

    expect(q.take(105)).toEqual([])
    expect(q.take(110).map((command) => command.seq)).toEqual([1, 2])
  })

  it('refuses a flood rather than growing without bound', () => {
    const q = queue()
    expect(MAX_QUEUED_COMMANDS).toBe(32)
    for (let seq = 1; seq <= MAX_QUEUED_COMMANDS; seq += 1)
      expect(q.submit(SEAT, input(seq, 150), 101).ok).toBe(true)
    expect(q.submit(SEAT, input(MAX_QUEUED_COMMANDS + 1, 150), 101)).toEqual({ ok: false, reason: 'full' })
  })

  it('remembers the sequence across a disconnect, so a reconnect continues it', () => {
    const q = queue()
    for (let seq = 1; seq <= 2_000; seq += 1) {
      q.submit(SEAT, input(seq, 100 + seq), 100 + seq)
      q.take(100 + seq)
    }
    // A reconnect: nothing about the seat's numbering is forgotten.
    expect(q.submit(SEAT, input(2_001, 2_101), 2_101).ok).toBe(true)
  })

  it('forgets a seat entirely, and everything on reset', () => {
    const q = queue()
    q.submit(SEAT, input(9, 101), 101)
    q.take(101)
    q.submit(SEAT, input(10, 102), 102)
    q.forget(SEAT)
    expect(q.take(102)).toEqual([])
    expect(q.submit(SEAT, input(1, 103), 103).ok).toBe(true)

    q.reset()
    expect(q.take(200)).toEqual([])
  })
})

describe('SV-b: a command takes effect at its stamped tick, or late, never rewound', () => {
  it('applies a command stamped for 120 that arrives at tick 100 at 120', () => {
    const q = queue()
    // The room has stepped tick 100; its next step is 101.
    expect(q.submit(SEAT, input(1, 120), 101)).toEqual({ ok: true, tick: 120, slack: 19 })
    for (let tick = 101; tick < 120; tick += 1) expect(q.take(tick)).toEqual([])
    expect(q.take(120)).toMatchObject([{ seq: 1, tick: 120 }])
  })

  it('applies one arriving at tick 125 at 126, reported late for the room to log `input.late`', () => {
    const q = queue()
    // The room has stepped tick 125; its next step is 126. A negative slack is what the room logs as `input.late`.
    const result = q.submit(SEAT, input(1, 120), 126)
    expect(result).toEqual({ ok: true, tick: 126, slack: -6 })
    expect(q.take(126)).toEqual([{ tick: 126, source: SEAT, seq: 1, type: 'move', payload: { right: true } }])
  })
})

describe('seats', () => {
  it('stamps the seat as the source, whatever the client sent', () => {
    const q = queue()
    const forged = { ...input(1, 101), source: 7 } as QueuedInput
    q.submit(3, forged, 101)
    expect(q.take(101)).toMatchObject([{ source: 3 }])
  })

  it('takes every seat’s commands, in seat order and then sequence order', () => {
    const q = queue()
    q.submit(2, input(1, 101), 101)
    q.submit(0, input(4, 101), 101)
    q.submit(2, input(2, 101), 101)
    q.submit(1, input(1, 102), 101)
    expect(q.take(101).map(({ source, seq }) => [source, seq])).toEqual([
      [0, 4],
      [2, 1],
      [2, 2],
    ])
    expect(q.take(102).map(({ source, seq }) => [source, seq])).toEqual([[1, 1]])
  })
})
