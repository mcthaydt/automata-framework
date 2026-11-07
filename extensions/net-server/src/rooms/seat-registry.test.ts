import type { ServerMessage } from '@automata/net'
import { describe, expect, it, vi } from 'vitest'
import { type SeatClient, SeatRegistry } from './seat-registry'

// FloorFifty `tests/server/rooms/seat-registry.test.ts` (13 cases), keyed by seat number. The announcement is net's
// `seated` message, which carries the seat alone (the room code is the Colyseus room id the client joined by).

const P1 = 0
const P2 = 1

/** A client that records what it was sent. */
function recordingClient(): SeatClient & { sent: ServerMessage[] } {
  const sent: ServerMessage[] = []
  return { sent, send: (message) => sent.push(message) }
}

describe('seats', () => {
  it('finds a session’s seat, and a seat’s session', () => {
    const seats = new SeatRegistry()
    seats.seat('s1', P1, recordingClient())
    expect(seats.seatOf('s1')).toBe(P1)
    expect(seats.sessionOf(P1)).toBe('s1')
    expect(seats.seatOf('nobody')).toBeUndefined()
    expect(seats.sessionOf(P2)).toBeUndefined()
  })

  it('keeps a returning session’s place in the seating order', () => {
    const seats = new SeatRegistry()
    seats.seat('s1', P1, recordingClient())
    seats.seat('s2', P2, recordingClient())
    seats.seat('s1', P1, recordingClient()) // a reconnect
    expect(seats.seats()).toEqual([P1, P2])
  })

  it('gives a live view of the seated seats, in seating order', () => {
    const seats = new SeatRegistry()
    seats.seat('s1', P2, recordingClient())
    seats.seat('s2', P1, recordingClient())
    expect([...seats.seated()]).toEqual([P2, P1])
  })

  it('keeps the others in order once the first seat frees', () => {
    const seats = new SeatRegistry()
    seats.seat('s1', P1, recordingClient())
    seats.seat('s2', P2, recordingClient())
    seats.release('s1')
    expect(seats.seats()).toEqual([P2])
    expect(seats.size).toBe(1)
  })

  it('frees every seat that is not kept', () => {
    const seats = new SeatRegistry()
    seats.seat('s1', P1, recordingClient())
    seats.seat('s2', P2, recordingClient())
    seats.keepOnly((seat) => seat === P2)
    expect(seats.seats()).toEqual([P2])
  })

  it('says which seats it freed, so the room can forget what they held', () => {
    const seats = new SeatRegistry()
    seats.seat('s1', P1, recordingClient())
    seats.seat('s2', P2, recordingClient())
    expect(seats.keepOnly((seat) => seat === P2)).toEqual([{ session: 's1', seat: P1 }])
  })

  it('remembers that someone sat down, after everyone has gone', () => {
    const seats = new SeatRegistry()
    expect(seats.everSeated).toBe(false)
    seats.seat('s1', P1, recordingClient())
    seats.release('s1')
    expect(seats.size).toBe(0)
    expect(seats.everSeated).toBe(true)
  })
})

describe('announcements', () => {
  it('tells a new seat its seat number, once', () => {
    const seats = new SeatRegistry()
    const client = recordingClient()
    seats.seat('s1', P2, client)
    seats.announce()
    seats.announce()
    expect(client.sent).toEqual([{ t: 'seated', seat: P2 }])
  })

  it('announces again after a reconnect', () => {
    const seats = new SeatRegistry()
    const client = recordingClient()
    seats.seat('s1', P1, client)
    seats.announce()
    seats.seat('s1', P1, client)
    seats.announce()
    expect(client.sent).toHaveLength(2)
  })

  it('announces nothing to a seat released before the tick', () => {
    const seats = new SeatRegistry()
    const client = recordingClient()
    seats.seat('s1', P1, client)
    seats.release('s1')
    seats.announce()
    expect(client.sent).toEqual([])
  })

  it('still announces the others when one client has already gone', () => {
    const seats = new SeatRegistry()
    const gone: SeatClient = {
      send: () => {
        throw new Error('socket closed')
      },
    }
    const present = recordingClient()
    seats.seat('s1', P1, gone)
    seats.seat('s2', P2, present)
    expect(() => seats.announce()).not.toThrow()
    expect(present.sent).toEqual([{ t: 'seated', seat: P2 }])
  })
})

describe('reconnection holds', () => {
  it('cancels a closed hold exactly once', () => {
    const seats = new SeatRegistry()
    const cancel = vi.fn()
    seats.hold('s1', cancel)
    seats.closeHold('s1')
    seats.closeHold('s1')
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('does not cancel a hold that already settled', () => {
    const seats = new SeatRegistry()
    const cancel = vi.fn()
    seats.hold('s1', cancel)
    seats.endHold('s1')
    seats.closeHold('s1')
    expect(cancel).not.toHaveBeenCalled()
  })
})
