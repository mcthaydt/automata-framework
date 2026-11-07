import type { Clock } from '@automata/framework'
import type { Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createClientPort } from '#src/features/client/room/net-port.ts'
import type { ConnectionState } from '#src/features/client/room/net-room.ts'
import type { RoomInfo } from '#src/features/client/room/room-info.ts'
import { createNetSession, type NetSessionHandle } from '#src/features/client/session/create-net-session.ts'
import type { LocalCommand } from '#src/features/client/session/net-session.ts'
import { createWatchable } from '#src/shared/watchable.ts'
import { NET_CHANNEL } from '#src/shared/wire/room.ts'
import { counterSim, Move, spawn } from '#src/testing/counter-game.ts'
import type { FakeRoom } from '#src/testing/fake-colyseus.ts'
import { type Harness, startHarness } from '#src/testing/net-room-harness.ts'

// createNetSession: the NetSession wired to a NetRoom, on the room harness, so the room, the session and the test
// share one fake clock.

const RIGHT: LocalCommand = { type: Move.id, payload: { dx: 1 } }
const right = (): readonly LocalCommand[] => [RIGHT]

let harnesses: Harness[] = []
const sims: Sim[] = []
afterEach(async () => {
  for (const h of harnesses) await h.close()
  harnesses = []
  for (const sim of sims.splice(0)) sim.dispose()
})

async function setup() {
  const h = await startHarness()
  harnesses.push(h)
  const client = await counterSim()
  const authority = await counterSim()
  sims.push(client, authority)
  authority.step([spawn(0, 0)])
  const start = authority.snapshot()
  const handle: NetSessionHandle = createNetSession({ room: h.room, sim: client, clock: h.clock })
  await h.room.create({ name: 'Ada' })
  await h.settle()
  const room = () => h.fake.rooms.at(-1) as FakeRoom
  /** The authority's snapshot at `tick`, sent by the current room; `hash` replaces the true one. */
  /** The room's sim starts over, as another room's does. */
  const restart = () => {
    authority.restore(start)
  }
  const snapshot = (tick: number, hash?: string) => {
    while (authority.tick < tick) authority.step([])
    room().message({ t: 'snap', tick: authority.tick, hash: hash ?? authority.hash(), acks: {} })
    room().bytes(authority.snapshot())
  }
  const play = async () => {
    room().message({ t: 'seated', seat: 0 })
    room().patch(h.fake.state('ABC234', { phase: 'playing' }))
    await h.settle()
  }
  const commands = (target: FakeRoom = room()) =>
    target.sent
      .filter((entry) => entry.type === NET_CHANNEL)
      .map((entry) => JSON.parse(String(entry.payload)))
      .filter((message) => message.t === 'cmd')
  const close = () => handle.close()
  return { h, handle, room, snapshot, play, commands, close, restart }
}

describe('createNetSession', () => {
  it("restores the room's snapshots, timestamped on the injected clock", async () => {
    const { h, handle, snapshot } = await setup()
    snapshot(30)
    expect(handle.session.authoritative?.tick).toBe(30)
    // A second of the fake clock later, authority is a second on: the session reads the clock, not frame deltas.
    await h.advance(1000)
    handle.session.frame(() => [], 0)
    expect(handle.session.authorityTick()).toBeCloseTo(90, 6)
  })

  it('takes input only from its seat, while the room is counting down or playing', async () => {
    const { h, handle, room, snapshot, commands } = await setup()
    snapshot(30)
    handle.session.frame(right, 1000 / 60)
    room().message({ t: 'seated', seat: 0 })
    await h.settle()
    handle.session.frame(right, 1000 / 60)
    expect(commands()).toEqual([])

    room().patch(h.fake.state('ABC234', { phase: 'countdown' }))
    await h.settle()
    // Time is the Clock's: a tick passes before the next frame reaches a new one.
    await h.advance(20)
    handle.session.frame(right, 20)
    expect(commands()).toEqual([
      { t: 'cmd', seq: 1, tick: handle.session.sampledTick, type: Move.id, payload: { dx: 1 } },
    ])
  })

  it('takes no input while reconnecting, and resends what was not acked once the room is back', async () => {
    const { h, handle, room, snapshot, play, commands } = await setup()
    await play()
    snapshot(30)
    handle.session.frame(right, 1000 / 60)
    const first = room()
    expect(commands(first)).toHaveLength(1)

    first.close(1006)
    expect(h.connection()).toBe('reconnecting')
    handle.session.frame(right, 1000 / 60)
    await h.settle()
    expect(h.connection()).toBe('connected')
    const second = room()
    expect(second).not.toBe(first)
    expect(commands(second)).toEqual(commands(first))
  })

  it('resends what was not acked when the room comes back degraded too', async () => {
    const { h, handle, room, snapshot, play, commands } = await setup()
    await play()
    snapshot(30)
    handle.session.frame(right, 1000 / 60)
    const first = room()
    h.room.markDegraded(true)
    first.close(1006)
    expect(h.connection()).toBe('reconnecting')
    await h.settle()
    expect(h.connection()).toBe('degraded')
    expect(commands(room())).toEqual(commands(first))
  })

  it('reads degraded while the round trips are slow and connected when they recover', async () => {
    const { h, handle, play } = await setup()
    await play()
    for (const rtt of [1200, 1300, 1100, 1250, 1400]) handle.diagnostics.roundTrip(rtt)
    expect(h.connection()).toBe('degraded')
    for (const rtt of [100, 100, 100, 100, 100]) handle.diagnostics.roundTrip(rtt)
    expect(h.connection()).toBe('connected')
  })

  it('forgets the mark with the game, as leaving a room does', async () => {
    const { h, handle, play } = await setup()
    await play()
    for (const rtt of [1200, 1300, 1100, 1250, 1400]) handle.diagnostics.roundTrip(rtt)
    await h.room.leave()
    expect(h.connection()).toBe('offline')
    expect(handle.diagnostics.degraded).toBe(false)
  })

  it('starts afresh in another room: its earlier ticks restore, and numbering starts over', async () => {
    const { h, handle, room, snapshot, play, commands, restart } = await setup()
    await play()
    snapshot(300)
    handle.session.frame(right, 1000 / 60)
    expect(commands()).toHaveLength(1)

    await h.room.leave()
    h.fake.respond('create', h.fake.room('XYZ234'))
    await h.room.create({ name: 'Ada' })
    await h.settle()
    room().message({ t: 'seated', seat: 0 })
    room().patch(h.fake.state('XYZ234', { phase: 'playing' }))
    await h.settle()
    // The new room's sim is at tick 30, far behind the old one's.
    restart()
    snapshot(30)
    expect(handle.session.authoritative?.tick).toBe(30)
    await h.advance(20)
    handle.session.frame(right, 20)
    expect(commands().map((command) => command.seq)).toEqual([1])
  })

  it('forgets the game when the player leaves, so joining the same room again starts afresh', async () => {
    const { h, handle, snapshot, play } = await setup()
    await play()
    snapshot(300)
    await h.room.leave()
    await h.settle()
    expect(handle.session.authoritative).toBeUndefined()
  })

  it('keeps its game across a reconnect', async () => {
    const { h, handle, room, snapshot, play } = await setup()
    await play()
    snapshot(300)
    room().close(1006)
    await h.settle()
    expect(h.connection()).toBe('connected')
    expect(handle.session.authoritative?.tick).toBe(300)
  })

  it('reads a desync as the session ending', async () => {
    const { handle, snapshot } = await setup()
    snapshot(30)
    snapshot(33, '0000000000000000')
    snapshot(36, '0000000000000000')
    expect(handle.ended.get()).toEqual({ reason: 'desync', tick: 36 })
  })

  it('plays again in a later room after a desync ended the last one', async () => {
    const { h, handle, room, snapshot, play, commands, restart } = await setup()
    await play()
    snapshot(30)
    snapshot(33, '0000000000000000')
    snapshot(36, '0000000000000000')
    expect(handle.ended.get()).toMatchObject({ reason: 'desync' })

    await h.room.leave()
    await h.settle()
    expect(handle.ended.get()).toBeUndefined()
    h.fake.respond('create', h.fake.room('XYZ234'))
    await h.room.create({ name: 'Ada' })
    await h.settle()
    room().message({ t: 'seated', seat: 0 })
    room().patch(h.fake.state('XYZ234', { phase: 'playing' }))
    await h.settle()
    restart()
    snapshot(30)
    expect(handle.session.authoritative?.tick).toBe(30)
    await h.advance(20)
    handle.session.frame(right, 20)
    expect(commands()).toHaveLength(1)
  })

  it('sends no probe once it is closed', async () => {
    const { h, handle, room, snapshot, play, close } = await setup()
    await play()
    snapshot(30)
    await close()
    const probes = () =>
      room()
        .sent.map((entry) => JSON.parse(String(entry.payload)))
        .filter((message) => message.t === 'ping' && message.tick !== -1)
    const before = probes().length
    await h.advance(300)
    handle.session.frame(right, 300)
    expect(probes()).toHaveLength(before)
  })

  it('hears nothing from the room once it is closed', async () => {
    const { handle, snapshot, close } = await setup()
    snapshot(30)
    await close()
    snapshot(33)
    expect(handle.session.authoritative?.tick).toBe(30)
  })
})

describe('the session clock', () => {
  it('reads the clock it is given, not the wall clock', async () => {
    // A clock the test moves by hand: the session follows it, whatever `Date` and `performance` say.
    let now = 0
    const clock: Clock = { now: () => now, setTimeout: () => 0, clearTimeout: () => undefined }
    const client = await counterSim()
    const authority = await counterSim()
    sims.push(client, authority)
    authority.step([spawn(0, 0)])
    while (authority.tick < 30) authority.step([])
    const port = createClientPort()
    const room = {
      port: port.port,
      info: createWatchable<RoomInfo | undefined>(undefined).view,
      connection: createWatchable<ConnectionState>('connected').view,
      markDegraded: () => undefined,
    }
    const handle = createNetSession({ room, sim: client, clock })
    port.events.snapshot({ tick: 30, bytes: authority.snapshot(), hash: authority.hash(), acks: {} })
    now = 1000
    handle.session.frame(() => [], 0)
    expect(handle.session.authorityTick()).toBeCloseTo(90, 6)
  })
})
