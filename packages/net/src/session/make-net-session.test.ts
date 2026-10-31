import type { Sim } from '@mcthaydt/automata-sim'
import { Clock, Effect, Exit, Scope, SubscriptionRef } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { createClientPort } from '../client/net-port'
import type { ConnectionState } from '../client/net-room'
import type { RoomInfo } from '../client/room-info'
import { counterSim, Move, spawn } from '../test-support/counter-game'
import { type Harness, startHarness } from '../test-support/net-room-harness'
import type { FakeRoom } from '../testing/fake-colyseus'
import { NET_CHANNEL } from '../wire/room'
import { makeNetSession, type NetSessionHandle } from './make-net-session'
import type { LocalCommand } from './net-session'

// makeNetSession: the NetSession wired to a NetRoom (M7 spec §4.2, §5 "per client frame", "drop and reconnect") on
// the M7.5a harness, so the room, the session and the test share one TestClock.

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
  const scope = await h.run(Scope.make())
  const handle: NetSessionHandle = await h.run(
    makeNetSession({ room: h.room, sim: client }).pipe(Scope.extend(scope)),
  )
  await h.run(h.room.create({ name: 'Ada' }))
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
  const close = () => h.run(Scope.close(scope, Exit.void))
  return { h, handle, room, snapshot, play, commands, close, restart }
}

describe('makeNetSession', () => {
  it("restores the room's snapshots, timestamped on Effect's Clock", async () => {
    const { h, handle, snapshot } = await setup()
    snapshot(30)
    expect(handle.session.authoritative?.tick).toBe(30)
    // A second of TestClock later, authority is a second on: the clock reads Effect's time, not frame deltas.
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

  it('starts afresh in another room: its earlier ticks restore, and numbering starts over', async () => {
    const { h, handle, room, snapshot, play, commands, restart } = await setup()
    await play()
    snapshot(300)
    handle.session.frame(right, 1000 / 60)
    expect(commands()).toHaveLength(1)

    await h.run(h.room.leave)
    h.fake.respond('create', h.fake.room('XYZ234'))
    await h.run(h.room.create({ name: 'Ada' }))
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
    await h.run(h.room.leave)
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
    const { h, handle, snapshot } = await setup()
    snapshot(30)
    snapshot(33, '0000000000000000')
    snapshot(36, '0000000000000000')
    expect(await h.run(handle.ended.get)).toEqual({ reason: 'desync', tick: 36 })
  })

  it('plays again in a later room after a desync ended the last one', async () => {
    const { h, handle, room, snapshot, play, commands, restart } = await setup()
    await play()
    snapshot(30)
    snapshot(33, '0000000000000000')
    snapshot(36, '0000000000000000')
    expect(await h.run(handle.ended.get)).toMatchObject({ reason: 'desync' })

    await h.run(h.room.leave)
    await h.settle()
    expect(await h.run(handle.ended.get)).toBeUndefined()
    h.fake.respond('create', h.fake.room('XYZ234'))
    await h.run(h.room.create({ name: 'Ada' }))
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

  it('sends no probe once its scope has closed', async () => {
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

  it('hears nothing from the room once its scope has closed', async () => {
    const { handle, snapshot, close } = await setup()
    snapshot(30)
    await close()
    snapshot(33)
    expect(handle.session.authoritative?.tick).toBe(30)
  })
})

describe('the session clock', () => {
  it("reads Effect's monotonic time, not the wall clock", async () => {
    // A wall clock that never moves (or moves back) beside a monotonic one that runs: the session follows the latter.
    let nanos = 0n
    const clock: Clock.Clock = {
      [Clock.ClockTypeId]: Clock.ClockTypeId,
      unsafeCurrentTimeMillis: () => 0,
      currentTimeMillis: Effect.succeed(0),
      unsafeCurrentTimeNanos: () => nanos,
      currentTimeNanos: Effect.sync(() => nanos),
      sleep: () => Effect.never,
    }
    const client = await counterSim()
    const authority = await counterSim()
    sims.push(client, authority)
    authority.step([spawn(0, 0)])
    while (authority.tick < 30) authority.step([])
    const port = createClientPort()
    const room = {
      port: port.port,
      info: SubscriptionRef.make<RoomInfo | undefined>(undefined).pipe(Effect.runSync),
      connection: SubscriptionRef.make<ConnectionState>('connected').pipe(Effect.runSync),
    }
    const scope = Effect.runSync(Scope.make())
    const handle = Effect.runSync(
      makeNetSession({ room, sim: client }).pipe(Effect.withClock(clock), Scope.extend(scope)),
    )
    port.events.snapshot({ tick: 30, bytes: authority.snapshot(), hash: authority.hash(), acks: {} })
    nanos = 1_000_000_000n
    handle.session.frame(() => [], 0)
    expect(handle.session.authorityTick()).toBeCloseTo(90, 6)
  })
})
