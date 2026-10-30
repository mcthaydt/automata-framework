import { CloseCode } from '@colyseus/core'
import { ROOM_NAME } from '@mcthaydt/automata-net'
import { createReplayStepper, unpackReplay } from '@mcthaydt/automata-sim/replay'
import { Effect } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import {
  joinOptions,
  settle,
  startTestServer,
  type TestClient,
  type TestServer,
  waitFor,
} from '../test-support/colyseus-harness'
import { FIXTURE_CONTENT, fixtureGame, fixtureServer, fixtureSim, Move } from '../test-support/fixture-game'
import { nodeReplayCompression } from './replay-compression'

// The generic room on Colyseus, end to end through @colyseus/testing (M7 spec §4.3, §5): join, ready, play,
// reconnect, leave, drain and bots, with real clients on an ephemeral port. FloorFifty race-room-lifecycle,
// race-room-reconnect, race-room-drain, race-room-cpus and race-room-replay, generic.

let server: TestServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

/** Steps the room until the clients hold a snapshot (and the info patch sent with it) from after this call. */
async function publish(test: TestServer, client: TestClient): Promise<void> {
  const before = client.of('snap').length
  await test.step(client.code, 3)
  await waitFor(() => client.of('snap').length > before, 'no snapshot arrived')
}

async function startPlay(test: TestServer, ...clients: TestClient[]): Promise<void> {
  for (const [index, client] of clients.entries())
    client.send({ t: 'ready', ready: true, req: `go-${index}` })
  await waitFor(
    () => clients.every((client) => client.of('answer').length > 0),
    'the room never answered ready',
  )
  const room = test.room(clients[0]?.code ?? '')
  for (let guard = 0; guard < 100 && room.engine.lobby.phase !== 'playing'; guard += 1)
    await test.step(room.roomId, 1)
  expect(room.engine.lobby.phase).toBe('playing')
}

describe('joining a room', () => {
  it('seats the host and a guest, tells each its seat and shows both in the room state', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    const guest = await server.joinById(host.code, 'Bea')
    expect(host.of('seated')).toEqual([{ t: 'seated', seat: 0 }])
    expect(guest.of('seated')).toEqual([{ t: 'seated', seat: 1 }])
    await publish(server, guest)
    await waitFor(() => guest.info().seats.length === 2, 'the guest never saw both seats')
    expect(guest.info()).toEqual({
      code: host.code,
      phase: 'lobby',
      hostSeat: 0,
      seats: [
        { seat: 0, name: 'Ada', ready: false, connected: true, bot: false },
        { seat: 1, name: 'Bea', ready: false, connected: true, bot: false },
      ],
    })
  })

  it('offers a lobby to quick match, and never a room that is playing', async () => {
    // Three seats, so the playing room still has one free: only the listing keeps a stranger out of it.
    server = await startTestServer({ def: fixtureServer({ seats: { min: 2, max: 3 } }) })
    const host = await server.create('Ada')
    const guest = await server.quickMatch('Bea')
    expect(guest.code).toBe(host.code)
    await startPlay(server, host, guest)
    const stranger = await server.quickMatch('Cy')
    expect(stranger.code).not.toBe(host.code)
  })

  it('refuses a join with options that are not the wire’s, and a third player in a two-seat room', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    await expect(server.colyseus.sdk.joinById(host.code, { name: 'Bea' })).rejects.toThrow(/REFUSED/)
    await server.joinById(host.code, 'Bea')
    await expect(server.colyseus.sdk.joinById(host.code, joinOptions('Cy'))).rejects.toThrow()
  })
})

describe('playing', () => {
  it('applies a command with the seat as source and publishes the snapshot bytes after their header', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    const guest = await server.joinById(host.code, 'Bea')
    await startPlay(server, host, guest)
    const room = server.room(host.code)
    guest.send({ t: 'cmd', seq: 0, tick: room.engine.tick, type: Move.id, payload: { dx: 1 } })
    await publish(server, guest)
    const header = guest.inbox.findLastIndex((entry) => 'message' in entry && entry.message.t === 'snap')
    const snap = guest.of('snap').at(-1)
    const bytes = guest.inbox[header + 1]
    if (snap === undefined || bytes === undefined || !('bytes' in bytes)) throw new Error('no snapshot bytes')
    expect(snap.acks).toEqual({ 1: 0 })
    const copy = await fixtureSim(1)
    copy.restore(bytes.bytes)
    expect(copy.hash()).toBe(snap.hash)
    copy.dispose()
  })
})

describe('seats over a lost connection', () => {
  it('holds a dropped seat and gives it back to the same client, told its seat again', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    const guest = await server.joinById(host.code, 'Bea')
    const room = server.room(host.code)
    await guest.leave(false)
    await waitFor(() => room.engine.info().seats[1]?.connected === false, 'the room never saw the drop')
    const back = await server.reconnect(guest.reconnectionToken)
    expect(back.sessionId).toBe(guest.sessionId)
    expect(back.of('seated')).toEqual([{ t: 'seated', seat: 1 }])
    expect(room.engine.info().seats[1]?.connected).toBe(true)
  })

  it('refuses the token once the grace has run out on room ticks, and the seat is free again', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    const guest = await server.joinById(host.code, 'Bea')
    const room = server.room(host.code)
    await guest.leave(false)
    await waitFor(() => room.engine.info().seats[1]?.connected === false, 'the room never saw the drop')
    // TEST_NET holds a dropped seat for one second: 60 room ticks.
    await server.step(host.code, 61)
    expect(room.engine.info().seats).toHaveLength(1)
    await expect(server.colyseus.sdk.reconnect(guest.reconnectionToken)).rejects.toThrow()
  })

  it('frees the seat of a player who leaves on purpose', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    const guest = await server.joinById(host.code, 'Bea')
    await guest.leave(true)
    const room = server.room(host.code)
    await waitFor(() => room.engine.info().seats.length === 1, 'the seat was never freed')
    await publish(server, host)
    await waitFor(() => host.info().seats.length === 1, 'the host never saw the seat freed')
  })
})

describe('draining', () => {
  it('closes a lobby with the server-shutdown code, and opens no new room', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    const drained = Effect.runPromise(server.runtime.drain)
    await waitFor(() => host.closedWith !== undefined, 'the lobby was never closed')
    expect(host.closedWith).toBe(CloseCode.SERVER_SHUTDOWN)
    await expect(server.colyseus.sdk.create(ROOM_NAME, joinOptions('Bea'))).rejects.toThrow(/SERVER_UPDATING/)
    expect(await drained).toBe('empty')
  })

  it('lets a game play on while draining, until the cap shuts the server', async () => {
    server = await startTestServer({ config: { drainCapMs: 1_000 } })
    const host = await server.create('Ada')
    const guest = await server.joinById(host.code, 'Bea')
    await startPlay(server, host, guest)
    const drained = Effect.runPromise(server.runtime.drain)
    const room = server.room(host.code)
    guest.send({ t: 'cmd', seq: 0, tick: room.engine.tick, type: Move.id, payload: { dx: 1 } })
    await publish(server, guest)
    expect(guest.of('snap').at(-1)?.acks).toEqual({ 1: 0 })
    expect(room.engine.lobby.phase).toBe('playing')
    expect(host.closedWith).toBeUndefined()
    expect(await drained).toBe('cap')
    await waitFor(() => host.closedWith !== undefined, 'the cap never closed the room')
  })
})

describe('bots', () => {
  it('seats a bot for the host, plays it to the end and offers a replay that gives the room its final hash', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    host.send({ t: 'bot.add', req: 'bot' })
    await waitFor(() => host.of('answer').length === 1, 'bot.add was never answered')
    expect(host.of('answer')).toEqual([{ t: 'answer', req: 'bot' }])
    await publish(server, host)
    await waitFor(() => host.info().seats[1]?.bot === true, 'the bot seat never showed')
    await startPlay(server, host)

    const room = server.room(host.code)
    for (let guard = 0; guard < 600 && room.engine.lobby.phase !== 'ended'; guard += 1) room.tick()
    expect(room.engine.lobby.phase).toBe('ended')
    const finalHash = room.engine.sim.hash()
    await settle()
    await waitFor(() => host.of('replay').length === 1, 'the replay was never offered')
    const header = host.inbox.findIndex((entry) => 'message' in entry && entry.message.t === 'replay')
    await waitFor(() => host.inbox.length > header + 1, 'the replay bytes never arrived')
    const bytes = host.inbox[header + 1]
    if (bytes === undefined || !('bytes' in bytes)) throw new Error('no replay bytes')
    const replay = await unpackReplay(bytes.bytes, nodeReplayCompression)
    expect(replay.ticks.some((entry) => entry.commands.some((command) => command.source === 1))).toBe(true)
    const stepper = await createReplayStepper(replay, {
      plugins: fixtureGame.plugins,
      content: FIXTURE_CONTENT,
    })
    expect(stepper.run().ok).toBe(true)
    expect(stepper.sim.hash()).toBe(finalHash)
    stepper.dispose()
  })
})
