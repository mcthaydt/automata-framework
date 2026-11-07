import type { LocalCommand } from '@automata/net'
import { afterEach, describe, expect, it } from 'vitest'
import { Move } from '#src/testing/fixture-game.ts'
import { type LinkPlayer, type LinkRoom, type LinkRoomOptions, linkRoom } from '#src/testing/link-room.ts'

// Does a networked game play as if it were local? The deterministic model: the real client session, the
// room's real input queue and the real sim, joined by seeded links on a fake clock.
//
// What it measures is the question itself: for every tick a client predicted, how far was its own avatar from where
// the room put it? Zero is "as if local". A command stamped with its tick and arriving in time takes effect on the
// same tick on both sides, so the answer is zero unless a command arrived late.

const RIGHT: LocalCommand = { type: Move.id, payload: { dx: 1 } }
const LEFT: LocalCommand = { type: Move.id, payload: { dx: -1 } }
/** A walk that changes its mind: right every fifth frame, left every seventh. */
const walk = (_index: number, _tick: number, frame: number): readonly LocalCommand[] =>
  frame % 5 === 0 ? [RIGHT] : frame % 7 === 0 ? [LEFT] : []

let rooms: LinkRoom[] = []
afterEach(async () => {
  for (const room of rooms) await room.dispose()
  rooms = []
})

interface Report {
  readonly room: LinkRoom
  readonly player: LinkPlayer
  /** Late commands over every command sent. */
  readonly lateShare: number
  /** |predicted - room| for each tick predicted, in ticks order, from `fromMs` into play. */
  misprediction(fromMs?: number): readonly number[]
}

async function runModel(options: Partial<LinkRoomOptions> & { readonly seconds?: number }): Promise<Report> {
  const room = await linkRoom({
    link: { latencyMs: 0, jitterMs: 0, loss: 0, duplicate: 0, reorder: 0 },
    players: 1,
    sample: walk,
    ...options,
  })
  rooms.push(room)
  await room.start()
  const startTick = room.engine.tick
  await room.runFor((options.seconds ?? 20) * 1000)
  const player = room.players[0] as LinkPlayer
  const late = room.logs.filter((event) => event.event === 'input.late').length
  return {
    room,
    player,
    lateShare: late / Math.max(1, player.sent.length),
    misprediction(fromMs = 0) {
      const seat = player.client.seat() as number
      const from = startTick + Math.round((fromMs * 60) / 1000)
      const out: number[] = []
      for (const [tick, x] of [...player.predicted].sort((a, b) => a[0] - b[0])) {
        const roomX = room.positions.get(tick)?.[seat]
        if (tick >= from && roomX !== undefined) out.push(Math.abs(x - roomX))
      }
      return out
    },
  }
}

const p99 = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.99) - 1)] ?? 0
}

describe('the netcode, modelled', () => {
  it('is exact on a perfect link', async () => {
    const report = await runModel({})
    expect(report.lateShare).toBe(0)
    // Only sampled ticks are recorded: a frame that reaches two ticks (frames land on whole milliseconds, ticks every
    // 16.7) samples the later one, so twenty seconds give somewhat fewer than 1,200. The count guards against an
    // empty sample passing as zero.
    expect(report.misprediction().length).toBeGreaterThan(600)
    expect(Math.max(...report.misprediction())).toBe(0)
  })

  it('plays as if local at a hundred-millisecond round trip', async () => {
    const report = await runModel({
      link: { latencyMs: 50, jitterMs: 10, loss: 0, duplicate: 0, reorder: 0 },
    })
    expect(report.lateShare).toBeLessThanOrEqual(0.01)
    expect(p99(report.misprediction())).toBe(0)
    // It led by about the round trip, which is what made that possible.
    expect(report.player.net.leadTicks).toBeGreaterThan(6)
  })

  it('holds its budget at a two-hundred-millisecond round trip with jitter', async () => {
    const report = await runModel({
      link: { latencyMs: 100, jitterMs: 25, loss: 0, duplicate: 0, reorder: 0 },
    })
    expect(report.lateShare).toBeLessThanOrEqual(0.05)
    expect(p99(report.misprediction())).toBeLessThanOrEqual(1)
  })

  it('recovers within its first probes when nothing measured the trip beforehand', async () => {
    // Its first commands may be late (a real correction, and bounded), but once the room has answered it is exact.
    const report = await runModel({
      link: { latencyMs: 50, jitterMs: 10, loss: 0, duplicate: 0, reorder: 0 },
      roundTripMs: null,
    })
    const settled = report.misprediction(2_000)
    expect(settled.length).toBeGreaterThan(600)
    expect(Math.max(...settled)).toBe(0)
  })

  it('walks as far over the network as it does locally', async () => {
    // Every command sampled takes effect: once input stops and the link drains, the room has the client's walk.
    const script = (index: number, tick: number, frame: number) =>
      frame < 600 ? walk(index, tick, frame) : []
    const local = await runModel({ sample: script, seconds: 12 })
    const remote = await runModel({
      sample: script,
      seconds: 12,
      link: { latencyMs: 50, jitterMs: 10, loss: 0, duplicate: 0, reorder: 0 },
    })
    const walked = (report: Report) =>
      report.player.sent.reduce((sum, command) => sum + (command.payload as { dx: number }).dx, 0)
    const finalX = (report: Report) =>
      report.room.positions.get(report.room.engine.tick - 1)?.[report.player.client.seat() as number]
    expect(walked(local)).not.toBe(0)
    expect(finalX(local)).toBe(walked(local))
    expect(finalX(remote)).toBe(walked(remote))
    expect(finalX(remote)).toBeGreaterThanOrEqual((finalX(local) as number) - 1)
  })

  it('predicts a one-off command on the very tick the room applies it', async () => {
    // One press, eight seconds in: it takes effect once, on the same tick, on both sides.
    const report = await runModel({
      link: { latencyMs: 50, jitterMs: 10, loss: 0, duplicate: 0, reorder: 0 },
      seconds: 12,
      sample: (_index, _tick, frame) => (frame === 480 ? [RIGHT] : []),
    })
    expect(report.player.sent).toHaveLength(1)
    const sampled = (report.player.sent[0] as { tick: number }).tick
    const seat = report.player.client.seat() as number
    expect(report.room.positions.get(sampled - 1)?.[seat]).toBe(0)
    expect(report.room.positions.get(sampled)?.[seat]).toBe(1)
    expect(report.player.predicted.get(sampled - 1)).toBe(0)
    expect(report.player.predicted.get(sampled)).toBe(1)
  })
})
