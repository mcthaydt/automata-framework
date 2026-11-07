import type { Command, Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import type { NetSnapshot } from '../client/colyseus-transport'
import { counterSim, Move, moverX, spawn } from '../test-support/counter-game'
import { NetDiagnostics } from './net-diagnostics'
import { NetSession, type NetSessionOptions } from './net-session'
import { blendViews, type RemoteView } from './snapshot-buffer'

// M7.5c: the session draws the other seats from the authoritative states (the view the game reads from each restored snapshot,
// blended at the drawn moment), and feeds the diagnostics. Without `remote`, nothing changes from M7.5b.

const TICK_MS = 1000 / 60
const sims: Sim[] = []
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose()
})

/** The room: a mover for seat 0 that steps right every tick it is told to; `at(tick)` is its snapshot. */
async function room() {
  const sim = await counterSim()
  sims.push(sim)
  const start = sim.snapshot()
  const stepTo = (tick: number, commands: readonly Command[] = []): void => {
    if (tick < sim.tick) sim.restore(start)
    while (sim.tick < tick) {
      const now = sim.tick
      const due = commands.filter((c) => c.tick === now).map((c) => ({ ...c, tick: now }))
      sim.step(now === 0 ? [spawn(0, 0), ...due] : due)
    }
  }
  return {
    sim,
    at(tick: number, commands: readonly Command[] = []): NetSnapshot {
      stepTo(tick, commands)
      return { tick: sim.tick, bytes: sim.snapshot(), hash: sim.hash(), acks: {} }
    },
  }
}
// The room moves seat 0 right by one on ticks 1..20.
const rightEveryTick = (until: number): Command[] =>
  Array.from({ length: until }, (_, i) => ({
    type: Move.id,
    payload: { dx: 1 },
    tick: i + 1,
    source: 0,
    seq: i + 1,
  })) as unknown as Command[]

const remote = {
  read: (sim: Sim): RemoteView => ({ a: { x: moverX(sim, 0) ?? 0 } }),
  blend: (a: RemoteView, b: RemoteView, t: number): RemoteView => blendViews(a, b, t),
}

async function harness(options: Partial<NetSessionOptions> = {}) {
  const sim = await counterSim()
  sims.push(sim)
  const authority = await room()
  const session = new NetSession({
    sim,
    snapshotTicks: 3,
    interpolationTicks: 6,
    remote,
    ...options,
  })
  session.setRoomState({ seat: 1, accepting: true })
  return { session, sim, room: authority }
}
const none = () => []

describe('remote interpolation in the session', () => {
  it('draws the others from the authoritative states, behind authority by the delay, blended', async () => {
    const { session, room: authority } = await harness()
    const moves = rightEveryTick(20)
    session.observe(authority.at(6, moves), 0)
    session.observe(authority.at(12, moves), 100)
    session.observe(authority.at(18, moves), 200)
    let frame = session.frame(none, TICK_MS)
    for (let i = 0; i < 5; i++) frame = session.frame(none, TICK_MS)
    expect(frame?.renderTick).toBeCloseTo((frame?.authorityTick as number) - 6, 1)
    const x = frame?.remote?.a?.x as number
    expect(x).toBeGreaterThanOrEqual(4)
    expect(x).toBeLessThanOrEqual(18)
    // The room's mover has taken one step per tick before the snapshot's tick: x = tick - 1.
    expect(x).toBeCloseTo((frame?.renderTick as number) - 1, 0)
  })

  it('reads the view from the restored authoritative state, not from the prediction stepped past it', async () => {
    const { sim, room: authority } = await harness()
    const reads: number[] = []
    const probe = {
      ...remote,
      read: (sim: Sim) => {
        reads.push(sim.tick)
        return remote.read(sim)
      },
    }
    const s = new NetSession({ sim, snapshotTicks: 3, interpolationTicks: 6, remote: probe })
    s.setRoomState({ seat: 1, accepting: true })
    s.observe(authority.at(6), 0)
    s.frame(none, TICK_MS)
    s.frame(none, TICK_MS)
    s.observe(authority.at(12), 100)
    expect(reads).toEqual([6, 12])
  })

  it('has no remote view without the option, and the frame is as in M7.5b', async () => {
    const { session, room: authority } = await harness({ remote: undefined })
    session.observe(authority.at(6), 0)
    const frame = session.frame(none, 0)
    expect(frame?.remote).toBeUndefined()
    expect(frame?.authorityTick).toBe(6)
  })

  it('holds the newest state past the buffer rather than extrapolating', async () => {
    const { session, room: authority } = await harness()
    const moves = rightEveryTick(20)
    session.observe(authority.at(6, moves), 0)
    session.observe(authority.at(12, moves), 100)
    let frame = session.frame(none, TICK_MS)
    for (let i = 0; i < 120; i++) frame = session.frame(none, TICK_MS)
    expect(frame?.remote?.a?.x).toBe(11)
  })
})

describe('diagnostics fed by the session', () => {
  it('counts snapshots, times round trips and watches the buffer', async () => {
    const time = { now: 0 }
    const diagnostics = new NetDiagnostics({ now: () => time.now })
    const pings: number[] = []
    const { session, room: authority } = await harness({
      diagnostics,
      now: () => time.now,
      ping: (tick) => {
        pings.push(tick)
        return pings.length
      },
    })
    session.observe(authority.at(6), 0)
    session.observe(authority.at(9), 50)
    time.now = 100
    session.frame(none, 100)
    time.now = 140
    session.pong({ id: 1, slack: 1 })
    const s = diagnostics.summary()
    expect(s.snapshots.count).toBe(2)
    expect(s.input.rttMs.last).toBe(40)
    expect(s.buffer.frames).toBe(1)
  })

  it('is forgotten when the session clears', async () => {
    const diagnostics = new NetDiagnostics({ now: () => 0 })
    const { session, room: authority } = await harness({ diagnostics })
    session.observe(authority.at(6), 0)
    session.clear()
    expect(diagnostics.summary().snapshots.count).toBe(0)
  })
})
