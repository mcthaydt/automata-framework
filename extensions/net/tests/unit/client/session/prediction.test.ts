import type { Sim } from '@automata/sim'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { NetSnapshot } from '#src/features/client/room/colyseus-transport.ts'
import { Prediction } from '#src/features/client/session/prediction.ts'
import { counterSim, move, moverX, spawn } from '#src/testing/counter-game.ts'

// Reconciliation by restore and re-step. Core's `Sim.tick` is the next tick to
// step, so a snapshot at T is the state before tick T, and its acks cover what the room took through T - 1.

let authority: Sim
let client: Sim
let prediction: Prediction

/** The authority's snapshot now, acking `acks` (seat → last seq taken). */
const snapshotOf = (sim: Sim, acks: Record<string, number> = {}): NetSnapshot => ({
  tick: sim.tick,
  bytes: sim.snapshot(),
  hash: sim.hash(),
  acks,
})

/** Steps the authority through `tick` (so its `tick` is `tick + 1`), with `commands` on the ticks they name. */
const stepAuthority = (through: number, commands: ReturnType<typeof move>[] = []): void => {
  while (authority.tick <= through) {
    const tick = authority.tick
    authority.step(commands.filter((command) => command.tick === tick))
  }
}

beforeEach(async () => {
  authority = await counterSim()
  client = await counterSim()
  prediction = new Prediction(client)
  // The room seats seat 0 on tick 0 and publishes at tick 3.
  authority.step([spawn(0, 0)])
  stepAuthority(2)
  expect(prediction.reconcile(snapshotOf(authority), 0, undefined)).toBe('restored')
})

afterEach(() => {
  authority.dispose()
  client.dispose()
})

describe('prediction', () => {
  it('applies a recorded command on the tick it was stamped with', () => {
    prediction.record(move(0, 0, 5))
    prediction.advanceThrough(4)
    expect(moverX(client, 0)).toBe(0)
    prediction.advanceThrough(5)
    expect(moverX(client, 0)).toBe(1)
    expect(client.tick).toBe(6)
  })

  it('re-steps the commands not yet acked, so a snapshot that agrees changes nothing', () => {
    prediction.record(move(0, 0, 5))
    prediction.advanceThrough(8)
    const predicted = client.hash()
    // The room has not reached tick 5 yet: a snapshot at 4 without the command.
    stepAuthority(3)
    expect(prediction.reconcile(snapshotOf(authority), 0, 8)).toBe('restored')
    expect(client.tick).toBe(9)
    expect(client.hash()).toBe(predicted)
    expect(prediction.pendingCommands).toHaveLength(1)
  })

  it('drops the commands the snapshot acks', () => {
    const command = move(0, 0, 5)
    prediction.record(command)
    prediction.advanceThrough(8)
    stepAuthority(5, [command])
    expect(prediction.reconcile(snapshotOf(authority, { '0': 0 }), 0, 8)).toBe('restored')
    expect(prediction.pendingCommands).toEqual([])
    expect(moverX(client, 0)).toBe(1)
    expect(client.tick).toBe(9)
  })

  it('applies a command whose tick has passed at the first tick re-stepped, as the room takes a late one', () => {
    prediction.record(move(0, 0, 5))
    prediction.advanceThrough(9)
    // The room reached tick 7 without it: it arrived late, and the room will take it on tick 7.
    stepAuthority(6)
    prediction.reconcile(snapshotOf(authority), 0, 9)
    stepAuthority(9, [move(0, 0, 7)])
    expect(client.hash()).toBe(authority.hash())
  })

  it('never applies a command before one sent ahead of it, whatever tick it was stamped with', () => {
    prediction.record(move(0, 0, 9))
    prediction.record(move(0, 1, 6, -1))
    prediction.advanceThrough(8)
    expect(moverX(client, 0)).toBe(0)
    prediction.advanceThrough(9)
    expect(moverX(client, 0)).toBe(0) // +1 then -1, both on tick 9
    stepAuthority(9, [move(0, 0, 9), move(0, 1, 9, -1)])
    expect(client.hash()).toBe(authority.hash())
  })

  it('ignores a snapshot no newer than the last one restored', () => {
    const repeated = snapshotOf(authority)
    prediction.record(move(0, 0, 4))
    prediction.advanceThrough(6)
    const predicted = client.hash()
    expect(prediction.reconcile(repeated, 0, 6)).toBe('stale')
    expect(client.hash()).toBe(predicted)
    expect(client.tick).toBe(7)
  })

  it('never steps on a frame whose hash differs: back to the last good snapshot, re-stepped, its ack unused', () => {
    prediction.record(move(0, 0, 5))
    prediction.advanceThrough(8)
    const predicted = client.hash()
    stepAuthority(5, [move(0, 0, 5)])
    const good = snapshotOf(authority, { '0': 0 })
    const corrupt = {
      ...good,
      hash: good.hash === '0000000000000000' ? '0000000000000001' : '0000000000000000',
    }
    expect(prediction.reconcile(corrupt, 0, 8)).toBe('mismatch')
    expect(client.hash()).toBe(predicted)
    expect(client.tick).toBe(9)
    expect(prediction.pendingCommands).toHaveLength(1)
    expect(prediction.authoritative?.tick).toBe(3)
  })

  it('treats bytes that do not restore as a mismatch and leaves the prediction as it was', () => {
    prediction.record(move(0, 0, 5))
    prediction.advanceThrough(8)
    const predicted = client.hash()
    stepAuthority(5)
    const good = snapshotOf(authority)
    expect(prediction.reconcile({ ...good, bytes: good.bytes.subarray(0, 10) }, 0, 8)).toBe('mismatch')
    expect(client.hash()).toBe(predicted)
    expect(client.tick).toBe(9)
  })

  it('reports the last good snapshot it restored', () => {
    expect(prediction.authoritative).toEqual({ tick: 3, hash: snapshotOf(authority).hash })
  })

  it('forgets its commands and its snapshot on clear', () => {
    prediction.record(move(0, 0, 5))
    prediction.clear()
    expect(prediction.pendingCommands).toEqual([])
    expect(prediction.authoritative).toBeUndefined()
  })
})

describe('a mismatch before any good snapshot', () => {
  it('rolls back to the state the sim started in', async () => {
    const fresh = await counterSim()
    const start = fresh.hash()
    const subject = new Prediction(fresh)
    const good = snapshotOf(authority)
    expect(subject.reconcile({ ...good, hash: '0000000000000000' }, 0, undefined)).toBe('mismatch')
    expect(fresh.tick).toBe(0)
    expect(fresh.hash()).toBe(start)
    fresh.dispose()
  })
})
