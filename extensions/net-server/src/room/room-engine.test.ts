import { NetOwner } from '@automata/net/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { type EngineHarness, engineHarness } from '../test-support/engine-harness'
import { fixtureSim, positions } from '../test-support/fixture-game'

// The room's tick and its messages (M7 spec §4.3 room rules, §5 per server tick, §6 failure policy), on the plain
// engine the Colyseus room adapts. FloorFifty race-room-lifecycle and race-room-commands, with the race left behind.

let room: EngineHarness | undefined
afterEach(() => {
  room?.dispose()
  room = undefined
})

const cmd = (seq: number, tick: number, dx = 1) => ({ t: 'cmd', seq, tick, type: 'move', payload: { dx } })

describe('a room seating players', () => {
  it('seats a join with seat.join and the game spawn on the next tick, and tells the client its seat', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    expect(room.sim.query(NetOwner)).toHaveLength(0)
    expect(ada.of('seated')).toEqual([])
    room.steps(1)
    expect(positions(room.sim)).toEqual({ 0: 0 })
    expect(ada.of('seated')).toEqual([{ t: 'seated', seat: 0 }])
    expect(room.engine.info()).toEqual({
      phase: 'lobby',
      hostSeat: 0,
      seats: [{ seat: 0, name: 'Ada', ready: false, connected: true, bot: false }],
    })
  })

  it('refuses a seat in a full room and once play has started', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    expect(() => room?.engine.admit()).toThrow(/every seat is taken/)
    room.startPlay(ada, bea)
    expect(() => room?.engine.admit()).toThrow(/already playing/)
  })
})

describe('a room taking commands', () => {
  it('drops commands in the lobby', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.steps(1)
    room.send(ada, cmd(0, room.sim.tick))
    room.steps(2)
    expect(positions(room.sim)).toEqual({ 0: 0 })
    expect(room.logs).toContainEqual({ event: 'refused', seat: 0, code: 'phase' })
  })

  it('starts the countdown when everyone is ready, and play when it runs out', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.send(ada, { t: 'ready', ready: true, req: 'r1' })
    expect(room.engine.lobby.phase).toBe('lobby')
    room.send(bea, { t: 'ready', ready: true, req: 'r1' })
    expect(room.engine.lobby.phase).toBe('countdown')
    expect(ada.of('answer')).toEqual([{ t: 'answer', req: 'r1' }])
    room.steps(2)
    expect(room.engine.lobby.phase).toBe('countdown')
    room.steps(1)
    expect(room.engine.lobby.phase).toBe('playing')
  })

  it('applies a command on its stamped tick with the seat as source, and acks its seq in the next snapshot', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.startPlay(ada, bea)
    const due = room.sim.tick + 1
    room.send(bea, cmd(0, due))
    room.steps(1)
    expect(positions(room.sim)).toEqual({ 0: 0, 1: 0 })
    room.steps(1)
    expect(positions(room.sim)).toEqual({ 0: 0, 1: 1 })
    room.steps(3)
    expect(bea.of('snap').at(-1)?.acks).toEqual({ 1: 0 })
  })

  it("publishes the sim's hash and bytes every snapshotEvery ticks, the bytes right after their header", async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.steps(7)
    const snaps = ada.of('snap')
    expect(snaps.map((snap) => snap.tick)).toEqual([3, 6])
    const header = ada.inbox.findIndex((entry) => 'message' in entry && entry.message.t === 'snap')
    const bytes = ada.inbox[header + 1]
    if (bytes === undefined || !('bytes' in bytes)) throw new Error('no bytes after the header')
    const copy = await fixtureSim(1)
    copy.restore(bytes.bytes)
    expect(copy.hash()).toBe(snaps[0]?.hash)
    expect(copy.tick).toBe(3)
    copy.dispose()
  })

  it.each([
    ['a payload the sim refuses', { t: 'cmd', seq: 0, tick: 0, type: 'move', payload: { dx: 5 } }, 'payload'],
    ['a command no plugin defines', { t: 'cmd', seq: 0, tick: 0, type: 'teleport', payload: {} }, 'type'],
    [
      "the room's own seat command",
      { t: 'cmd', seq: 0, tick: 0, type: 'seat.leave', payload: { seat: 0 } },
      'type',
    ],
    ['a message that is not JSON', '{nope', 'not-json'],
    ['a message that fails the wire schema', { t: 'cmd', seq: -1 }, 'invalid'],
  ])('drops %s before it reaches the sim', async (_, message, code) => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.startPlay(ada, bea)
    if (typeof message === 'string') room.engine.receive(ada.session, message)
    else room.send(ada, 'tick' in message ? { ...message, tick: room.sim.tick } : message)
    room.steps(1)
    expect(room.logs).toContainEqual({ event: 'refused', seat: 0, code })
    expect(positions(room.sim)).toEqual({ 0: 0, 1: 0 })
  })

  it("drops a command past the seat's budget and keeps the seat connected", async () => {
    room = await engineHarness({ commandsPerSeat: { burst: 2, perSecond: 0 } })
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.startPlay(ada, bea)
    const tick = room.sim.tick
    for (let seq = 0; seq < 3; seq += 1) room.send(ada, cmd(seq, tick))
    room.steps(1)
    expect(positions(room.sim)).toEqual({ 0: 2, 1: 0 })
    expect(room.logs).toContainEqual({ event: 'refused', seat: 0, code: 'rate' })
    expect(ada.closed).toBe(false)
  })

  it('applies a late command on the next tick, never rewinding, and logs input.late (SV-b)', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.startPlay(ada, bea)
    room.send(ada, cmd(0, room.sim.tick - 2))
    room.steps(1)
    expect(positions(room.sim)).toEqual({ 0: 1, 1: 0 })
    expect(room.logs).toContainEqual({ event: 'input.late', seat: 0, count: 2 })
  })

  it("answers a ping with how many ticks early the probe's tick arrived", async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.steps(10)
    room.send(ada, { t: 'ping', id: 1, tick: 14 })
    expect(ada.of('pong')).toEqual([{ t: 'pong', id: 1, slack: 4 }])
    // A second probe inside 50 ms of room time is not answered: a probe cannot become a flood.
    room.send(ada, { t: 'ping', id: 2, tick: 14 })
    expect(ada.of('pong')).toHaveLength(1)
    room.now += 50
    room.send(ada, { t: 'ping', id: 3, tick: -1 })
    expect(ada.of('pong').at(-1)).toEqual({ t: 'pong', id: 3, slack: -10 })
  })

  it('answers a resent request from history, so it never acts twice', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.join('Bea')
    room.send(ada, { t: 'ready', ready: true, req: 'r1' })
    room.send(ada, { t: 'ready', ready: false, req: 'r2' })
    room.send(ada, { t: 'ready', ready: true, req: 'r1' })
    expect(room.engine.info().seats[0]?.ready).toBe(false)
    expect(ada.of('answer')).toEqual([
      { t: 'answer', req: 'r1' },
      { t: 'answer', req: 'r2' },
      { t: 'answer', req: 'r1' },
    ])
  })
})
