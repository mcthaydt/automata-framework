import { afterEach, describe, expect, it } from 'vitest'
import { type EngineHarness, engineHarness, fakeClient } from '#src/testing/engine-harness.ts'
import { positions } from '#src/testing/fixture-game.ts'

// Seats coming and going, on room ticks. The grace here is one second: 60 ticks.

let room: EngineHarness | undefined
afterEach(() => {
  room?.dispose()
  room = undefined
})

const cmd = (seq: number, tick: number) => ({ t: 'cmd', seq, tick, type: 'move', payload: { dx: 1 } })

describe('a dropped seat', () => {
  it("is held, shown as dropped and not ready, and keeps the host's role", async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.join('Bea')
    room.send(ada, { t: 'ready', ready: true, req: 'r1' })
    room.engine.drop(ada.session)
    expect(room.engine.info().seats[0]).toMatchObject({ seat: 0, ready: false, connected: false })
    expect(room.engine.info().hostSeat).toBe(0)
    room.steps(30)
    expect(room.engine.info().seats).toHaveLength(2)
  })

  it('returns to the same seat, is told it again, and continues its numbering after a transport reconnect', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.startPlay(ada, bea)
    room.send(ada, cmd(0, room.sim.tick))
    room.send(ada, cmd(1, room.sim.tick))
    room.steps(1)
    room.engine.drop(ada.session)
    room.steps(5)
    const back = fakeClient(ada.session)
    room.engine.reconnect(ada.session, back)
    room.steps(1)
    expect(back.of('seated')).toEqual([{ t: 'seated', seat: 0 }])
    // The next command is taken; a resend of one already applied is refused by its seq.
    room.send(back, cmd(2, room.sim.tick))
    room.send(back, cmd(1, room.sim.tick))
    room.steps(1)
    expect(positions(room.sim)[0]).toBe(3)
    expect(room.logs).toContainEqual({ event: 'refused', seat: 0, code: 'sequence' })
  })

  it("forgets a reloaded client's numbering, which starts again from 0", async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.startPlay(ada, bea)
    for (let seq = 0; seq < 3; seq += 1) room.send(ada, cmd(seq, room.sim.tick))
    room.steps(1)
    room.engine.drop(ada.session)
    const reloaded = fakeClient(ada.session)
    room.engine.reconnect(ada.session, reloaded)
    room.send(reloaded, cmd(0, room.sim.tick))
    room.send(reloaded, cmd(1, room.sim.tick))
    room.steps(1)
    expect(positions(room.sim)[0]).toBe(5)
  })

  it('is given up on room ticks when the grace runs out: the sim hears seat.leave and the hold is closed', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.join('Bea')
    room.steps(1)
    let cancelled = 0
    room.engine.drop(ada.session)
    room.engine.hold(ada.session, () => {
      cancelled += 1
    })
    room.steps(60)
    expect(positions(room.sim)).toEqual({ 0: 0, 1: 0 })
    room.steps(1)
    expect(positions(room.sim)).toEqual({ 1: 0 })
    expect(cancelled).toBe(1)
    expect(room.engine.seatOf(ada.session)).toBeUndefined()
    expect(room.engine.info().hostSeat).toBe(1)
  })
})

describe('a seat given up', () => {
  it('is freed at once by a leave, which hands the host on and is answered before the connection closes', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.join('Bea')
    room.steps(1)
    room.send(ada, { t: 'leave', req: 'bye' })
    expect(ada.of('answer')).toEqual([{ t: 'answer', req: 'bye' }])
    expect(ada.closed).toBe(true)
    room.steps(1)
    expect(positions(room.sim)).toEqual({ 1: 0 })
    expect(room.engine.info()).toMatchObject({ hostSeat: 1, seats: [{ seat: 1 }] })
  })

  it('gives the freed seat to the next player, whose numbering starts afresh', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.steps(1)
    room.engine.leave(ada.session)
    const cy = room.join('Cy')
    room.steps(1)
    expect(cy.of('seated')).toEqual([{ t: 'seated', seat: 0 }])
    room.startPlay(cy, bea)
    room.send(cy, cmd(0, room.sim.tick))
    room.steps(1)
    expect(positions(room.sim)).toEqual({ 0: 1, 1: 0 })
  })
})

describe('an empty room', () => {
  it('asks to close once the last person who sat in it is gone', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.steps(1)
    room.engine.leave(ada.session)
    room.steps(1)
    expect(room.closes).toEqual(['abandoned'])
  })

  it('waits the grace for its first client, whose socket is still on its way', async () => {
    room = await engineHarness()
    room.steps(60)
    expect(room.closes).toEqual([])
    room.steps(1)
    expect(room.closes).toEqual(['abandoned'])
  })

  it('stays open while a dropped seat can still come back', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.steps(1)
    room.engine.drop(ada.session)
    room.steps(30)
    expect(room.closes).toEqual([])
    room.steps(31)
    expect(room.closes).toEqual(['abandoned'])
  })
})
