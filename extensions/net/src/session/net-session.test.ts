import type { Command, Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import type { NetSnapshot } from '../client/colyseus-transport'
import { counterSim, Move, moverX, spawn } from '../test-support/counter-game'
import { INITIAL_LEAD_TICKS } from './input-lead'
import {
  type LocalCommand,
  MAX_CATCH_UP_TICKS,
  MAX_PENDING_COMMANDS,
  NetSession,
  type NetSessionOptions,
  PING_EVERY_MS,
  type SessionEnd,
} from './net-session'

// Ported from FloorFifty `tests/client/systems/netcode/race-netcode.test.ts` (677d4568), made game-agnostic: the
// race's snapshot is the sim's own, an `InputIntent` is the commands a sampler returns for a tick, and the drawn
// racer is the predicted sim. Cases FloorFifty had that are not here are listed, with the reason, in the M7.5b plan.

const TICK_MS = 1000 / 60
const RIGHT: LocalCommand = { type: Move.id, payload: { dx: 1 } }
const LEFT: LocalCommand = { type: Move.id, payload: { dx: -1 } }
const none = (): readonly LocalCommand[] => []
const right = (): readonly LocalCommand[] => [RIGHT]

const sims: Sim[] = []
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose()
})

/** The room's sim, which seats seat 0 on tick 0; `at(tick)` is its snapshot at that tick. */
async function room() {
  const sim = await counterSim()
  sims.push(sim)
  const start = sim.snapshot()
  const stepTo = (tick: number, commands: readonly Command[] = []): void => {
    if (tick < sim.tick) sim.restore(start)
    while (sim.tick < tick) {
      const now = sim.tick
      const due = commands
        .filter((command) => command.tick === now)
        .map((command) => ({ ...command, tick: now }))
      sim.step(now === 0 ? [spawn(0, 0), ...due] : due)
    }
  }
  return {
    sim,
    stepTo,
    at(tick: number, acks: Record<string, number> = {}, commands: readonly Command[] = []): NetSnapshot {
      stepTo(tick, commands)
      return { tick: sim.tick, bytes: sim.snapshot(), hash: sim.hash(), acks }
    },
  }
}

async function harness(options: Partial<NetSessionOptions> = {}) {
  const sim = await counterSim()
  sims.push(sim)
  const authority = await room()
  const sent: Command[] = []
  const pings: number[] = []
  const ends: SessionEnd[] = []
  const session = new NetSession({
    sim,
    send: (command) => sent.push(command),
    ping: (tick) => {
      pings.push(tick)
      return pings.length
    },
    onEnd: (end) => ends.push(end),
    ...options,
  })
  session.setRoomState({ seat: 0, accepting: true })
  return { session, sim, room: authority, sent, pings, ends }
}

describe('the session', () => {
  it('sends its first command at once, stamped with the tick it predicts', async () => {
    const { session, room, sent } = await harness()
    session.observe(room.at(30))
    session.frame(right, TICK_MS)

    expect(sent).toHaveLength(1)
    // Authority is at about tick 31 on the one clock; the command is stamped the lead's worth past it, which is when
    // it takes effect on both sides.
    // Numbered from 1, as FloorFifty does: the room reads seq 0 from a returned seat as a restart (M7.3b), so 0 is
    // never sent.
    expect(sent[0]).toMatchObject({ tick: session.sampledTick, source: 0, seq: 1, type: Move.id })
    expect((sent[0] as Command).tick - 31).toBeGreaterThanOrEqual(INITIAL_LEAD_TICKS - 1)
  })

  it('sends exactly what the sampler returns, once each, numbered by one, never stamped backward', async () => {
    const { session, room, sent } = await harness()
    session.observe(room.at(30))
    for (let frame = 0; frame < 5; frame += 1) session.frame(none, TICK_MS)
    expect(sent).toEqual([])

    const stamps: number[] = []
    for (const commands of [[RIGHT], [RIGHT, LEFT], [], [RIGHT]]) {
      session.frame(() => commands, TICK_MS)
      for (const _ of commands) stamps.push(session.sampledTick as number)
    }
    expect(sent.map((command) => command.payload)).toEqual([{ dx: 1 }, { dx: 1 }, { dx: -1 }, { dx: 1 }])
    expect(sent.map((command) => command.tick)).toEqual(stamps)
    sent.forEach((command, index) => {
      expect(command.seq).toBe(index + 1)
      if (index > 0) expect(command.tick).toBeGreaterThanOrEqual((sent[index - 1] as Command).tick)
    })
  })

  it('stamps a command on the latest tick a long frame reaches, sampling once', async () => {
    const { session, room, sent } = await harness()
    session.observe(room.at(30))
    session.frame(none, TICK_MS)
    const before = session.sampledTick as number

    // A hitch: one frame covers three ticks. The key could only be noticed now.
    let samples = 0
    session.frame(() => {
      samples += 1
      return [LEFT]
    }, TICK_MS * 3)
    expect(samples).toBe(1)
    expect(sent.at(-1)?.tick).toBe(session.sampledTick)
    expect((session.sampledTick as number) - before).toBeGreaterThanOrEqual(2)
  })

  it('sends nothing while the room is not taking input, or before it knows its seat', async () => {
    const { session, room, sent } = await harness()
    session.setRoomState({ seat: 0, accepting: false })
    session.observe(room.at(30))
    session.frame(right, TICK_MS)
    session.setRoomState({ seat: undefined, accepting: true })
    session.frame(right, TICK_MS)
    expect(sent).toEqual([])

    session.setRoomState({ seat: 0, accepting: true })
    session.frame(right, TICK_MS)
    expect(sent).toHaveLength(1)
  })

  it('re-seats after a long gap instead of sampling every tick it missed', async () => {
    const { session, room, sent } = await harness()
    session.observe(room.at(30))
    session.frame(none, TICK_MS)
    const before = session.sampledTick as number
    let samples = 0

    session.observe(room.at(630))
    session.frame(() => {
      samples += 1
      return [RIGHT]
    }, TICK_MS)

    expect(samples).toBe(1)
    expect((session.sampledTick as number) - before).toBeGreaterThan(MAX_CATCH_UP_TICKS)
    expect(sent.at(-1)?.tick).toBe(session.sampledTick)
  })

  it('keeps sampling if the clock ever lands far behind the input tick', async () => {
    // Input must never go dead waiting for a clock to catch up with it. A room whose timeline restarted far behind
    // (half a second of snapshots agreeing) moves the clock back; the input tick re-seats behind with it.
    const { session, room, sent } = await harness()
    session.observe(room.at(300))
    session.frame(none, TICK_MS)
    const ahead = session.sampledTick as number
    for (let frame = 0; frame < 40; frame += 1) {
      session.observe(room.at(30 + frame))
      session.frame(none, TICK_MS)
    }
    expect(session.authorityTick()).toBeLessThan(100)
    expect(session.sampledTick).toBeLessThan(ahead - MAX_CATCH_UP_TICKS)
    session.frame(right, TICK_MS)
    expect(sent.at(-1)).toMatchObject({ payload: { dx: 1 }, tick: session.sampledTick })
  })

  it('predicts again on a restarted timeline once the clock adopts it, not only sends', async () => {
    const { session, room, sim } = await harness()
    session.observe(room.at(300))
    session.frame(none, TICK_MS)
    for (let frame = 0; frame < 40; frame += 1) {
      session.observe(room.at(30 + frame))
      session.frame(none, TICK_MS)
    }
    // The next snapshot of the restarted timeline restores, and a command is applied in the sim, not only sent.
    session.observe(room.at(70))
    expect(session.authoritative?.tick).toBe(70)
    session.frame(right, TICK_MS)
    expect(sim.tick).toBe((session.sampledTick as number) + 1)
    expect(moverX(sim, 0)).toBe(1)
  })

  it('sends the commands not yet acked again after the connection comes back', async () => {
    const { session, room, sent } = await harness()
    session.observe(room.at(30))
    session.frame(right, TICK_MS)
    session.frame(() => [LEFT], TICK_MS)
    session.frame(none, TICK_MS)
    expect(sent).toHaveLength(2)
    const [first, second] = sent as [Command, Command]

    // The room took the first before the drop; the second went nowhere.
    session.observe(room.at(first.tick + 1, { '0': first.seq }, [first]))
    session.resync()
    expect(sent).toHaveLength(3)
    expect(sent[2]).toEqual(second)
  })

  it("numbers on from the room's count when it takes over a seat already in play", async () => {
    // A reloaded page reclaims its seat with a fresh session; the room kept the seat's numbering.
    const { session, room, sent } = await harness()
    session.observe(room.at(30, { '0': 40 }))
    session.frame(right, TICK_MS)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ seq: 41 })
  })

  it('probes the clock on a schedule and lets the answers steer the lead', async () => {
    const { session, room, pings } = await harness()
    session.observe(room.at(30))
    for (let frame = 0; frame < Math.ceil(PING_EVERY_MS / TICK_MS) + 2; frame += 1)
      session.frame(none, TICK_MS)
    expect(pings).toHaveLength(2)

    // The room says the first probe arrived ten ticks late: the lead has to grow.
    const before = session.leadTicks
    session.pong({ id: 1, slack: -10 })
    expect(session.leadTicks).toBeGreaterThan(before + 9)
  })

  it('does not steer the lead from a probe sent while the clock was catching up', async () => {
    const { session, room } = await harness()
    session.observe(room.at(30))
    session.observe(room.at(39)) // nine ticks ahead of the clock: not snapped, not caught up
    session.frame(none, TICK_MS)
    const before = session.leadTicks

    session.pong({ id: 1, slack: -110 })
    expect(session.leadTicks).toBe(before)
  })

  it('starts with the lead a measured round trip asks for', async () => {
    expect((await harness({ roundTripMs: 200 })).session.leadTicks).toBeCloseTo(200 / TICK_MS + 3, 9)
    expect((await harness()).session.leadTicks).toBe(INITIAL_LEAD_TICKS)
  })

  it('stands the predicted sim at the sampled tick, ahead of authority', async () => {
    const { session, room, sim } = await harness()
    session.observe(room.at(30))
    const frame = session.frame(none, TICK_MS)
    expect(frame?.predictedTick).toBe(session.sampledTick)
    expect(sim.tick).toBe((session.sampledTick as number) + 1)
    expect(frame?.predictedTick).toBeGreaterThan(frame?.authorityTick as number)
  })

  it('steps the prediction once per tick on a 144 Hz display, sampling once per tick, never two at once', async () => {
    const { session, room, sim } = await harness()
    session.observe(room.at(30))
    session.frame(none, 1000 / 144)
    const first = sim.tick
    let samples = 0
    let previous = sim.tick
    for (let frame = 0; frame < 144; frame += 1) {
      session.frame(() => {
        samples += 1
        return []
      }, 1000 / 144)
      expect(sim.tick - previous).toBeLessThanOrEqual(1)
      previous = sim.tick
    }
    // A second of frames is sixty ticks, each sampled once.
    expect(sim.tick - first).toBeGreaterThanOrEqual(59)
    expect(sim.tick - first).toBeLessThanOrEqual(61)
    expect(samples).toBe(sim.tick - first)
  })

  it('leaves the predicted state as it was when a snapshot agrees with it', async () => {
    const { session, room, sim, sent } = await harness()
    session.observe(room.at(30))
    for (let frame = 0; frame < 13; frame += 1) session.frame(right, 1000 / 144)
    const predicted = sim.hash()
    const tick = sim.tick

    // The room took every command stamped before T, each on its tick, and has not reached the rest.
    const at = (sent[0] as Command).tick + 2
    const taken = sent.filter((command) => command.tick < at)
    expect(taken.length).toBeGreaterThan(0)
    expect(at).toBeLessThan(session.sampledTick as number)
    session.observe(room.at(at, { '0': (taken.at(-1) as Command).seq }, taken))
    expect(sim.tick).toBe(tick)
    expect(sim.hash()).toBe(predicted)
  })

  it('forgets everything when the game is left, its numbering included', async () => {
    const { session, room, sent } = await harness()
    session.observe(room.at(300))
    session.frame(right, TICK_MS)
    session.clear()
    expect(session.sampledTick).toBeUndefined()
    expect(session.pendingCommands).toEqual([])
    expect(session.authoritative).toBeUndefined()
    expect(session.frame(none, TICK_MS)).toBeUndefined()

    // Another room: its earlier ticks restore, and it numbers from 1 (or from its own ack, as on a takeover).
    session.observe(room.at(30))
    expect(session.authoritative?.tick).toBe(30)
    session.frame(right, TICK_MS)
    expect(sent.at(-1)).toMatchObject({ seq: 1 })
  })
})

describe('commands the room has not taken', () => {
  it('resends, once, a command a snapshot shows overdue', async () => {
    const { session, room, sent } = await harness()
    session.observe(room.at(30))
    session.frame(right, TICK_MS)
    const command = sent[0] as Command

    // The room stepped past its tick without it: lost or late. It is sent again, with its own seq and tick.
    session.observe(room.at(command.tick + 3))
    expect(sent).toEqual([command, command])
    session.observe(room.at(command.tick + 6))
    expect(sent).toHaveLength(2)
  })
})

describe('commands the room never takes', () => {
  it('are given up once overdue by more than the room would ever wait, so they stop being replayed', async () => {
    const { session, room, sim, sent } = await harness()
    session.observe(room.at(30))
    session.frame(right, TICK_MS)
    const command = sent[0] as Command
    session.observe(room.at(command.tick + 3)) // resent once
    expect(session.pendingCommands).toHaveLength(1)

    // Past maxLeadTicks (60) overdue, the room has refused it or never had it: it goes, and the prediction with it.
    session.observe(room.at(command.tick + 63))
    expect(session.pendingCommands).toEqual([])
    expect(sim.hash()).toBe(room.sim.hash())
    expect(sent).toHaveLength(2)
  })

  it('applies and sends every command at a long lead, two a tick', async () => {
    // A 30-tick lead holds about 33 ticks of unacked commands: at two a tick, well past the room's 32 queued, all of
    // which the room takes in time, since its queue holds only what has arrived and is not yet due.
    const { session, room, sim, sent } = await harness({ roundTripMs: 1_000 })
    expect(session.leadTicks).toBe(30)
    session.observe(room.at(30))
    for (let frame = 0; frame < 40; frame += 1) session.frame(() => [RIGHT, RIGHT], TICK_MS)
    expect(sent).toHaveLength(80)
    expect(session.pendingCommands).toHaveLength(80)
    expect(moverX(sim, 0)).toBe(80)
  })

  it('holds a generous bound of unacked commands, dropping the newest sample past it', async () => {
    const { session, room, sent } = await harness()
    session.observe(room.at(30))
    for (let frame = 0; frame < 30; frame += 1)
      session.frame(() => Array.from({ length: 10 }, () => RIGHT), TICK_MS)
    expect(session.pendingCommands).toHaveLength(MAX_PENDING_COMMANDS)
    expect(sent).toHaveLength(MAX_PENDING_COMMANDS)
  })
})

describe('a session that ended', () => {
  it('starts over on clear: a later game plays', async () => {
    const { session, room, sent } = await harness()
    session.observe(room.at(30))
    const bad = room.at(33)
    session.observe({ ...bad, hash: '0000000000000000' })
    session.observe({ ...room.at(36), hash: '0000000000000000' })
    expect(session.ended?.reason).toBe('desync')

    session.clear()
    expect(session.ended).toBeUndefined()
    expect(session.mismatches).toBe(0)
    session.observe(room.at(30))
    expect(session.authoritative?.tick).toBe(30)
    session.frame(right, TICK_MS)
    expect(sent.at(-1)).toMatchObject({ seq: 1 })
    // A single mismatch later is a first one again, not a second.
    session.observe({ ...room.at(39), hash: '0000000000000000' })
    expect(session.ended).toBeUndefined()
  })
})

describe('a snapshot that fails its hash (N-d)', () => {
  const corrupt = (snapshot: NetSnapshot): NetSnapshot => ({
    ...snapshot,
    hash: snapshot.hash === '0000000000000000' ? '0000000000000001' : '0000000000000000',
  })

  it('ends the session on a second mismatch within ten seconds, and is never stepped on', async () => {
    let now = 0
    const { session, room, sim, sent, ends } = await harness({ now: () => now })
    session.observe(room.at(30))
    session.frame(right, TICK_MS)

    session.observe(corrupt(room.at(33)))
    expect(session.mismatches).toBe(1)
    expect(session.ended).toBeUndefined()
    expect(session.authoritative?.tick).toBe(30)

    now = 9_000
    const predicted = sim.hash()
    session.observe(corrupt(room.at(36)))
    expect(sim.hash()).toBe(predicted)
    expect(session.ended).toEqual({ reason: 'desync', tick: 36 })
    expect(ends).toEqual([{ reason: 'desync', tick: 36 }])

    // Ended: nothing is restored, sampled or sent any more.
    const count = sent.length
    session.observe(room.at(39))
    expect(session.authoritative?.tick).toBe(30)
    expect(session.frame(right, TICK_MS)).toBeUndefined()
    expect(sent).toHaveLength(count)
    expect(ends).toHaveLength(1)
  })

  it('does not end the session for two mismatches more than ten seconds apart', async () => {
    let now = 0
    const { session, room } = await harness({ now: () => now })
    session.observe(room.at(30))
    session.observe(corrupt(room.at(33)))
    now = 10_001
    session.observe(corrupt(room.at(36)))
    expect(session.mismatches).toBe(2)
    expect(session.ended).toBeUndefined()
    // The next good snapshot is the resync.
    session.observe(room.at(39))
    expect(session.authoritative?.tick).toBe(39)
  })
})
