import { createRng } from '@mcthaydt/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import { Move } from '../test-support/fixture-game'
import { type LinkRoom, linkRoom } from '../test-support/link-room'

// N-a, N-b and N-d (M7 spec §13) over seeded links on TestClock: the room engine and two clients, each a real
// transport, port and NetSession, playing the fixture game. Nothing waits on a real timer, so each run replays exactly.

const ROUGH = { latencyMs: 100, jitterMs: 30, loss: 0.02, duplicate: 0.01, reorder: 0.01 }
const QUIET = { latencyMs: 40, jitterMs: 10, loss: 0, duplicate: 0, reorder: 0 }

/** Each player moves on about one sampled tick in four, left or right, from its own seeded stream. */
function wander() {
  const streams = new Map<number, ReturnType<typeof createRng>>()
  return (index: number) => {
    let rng = streams.get(index)
    if (rng === undefined) {
      rng = createRng(1000 + index)
      streams.set(index, rng)
    }
    const roll = rng.int(8)
    return roll === 0
      ? [{ type: Move.id, payload: { dx: -1 } }]
      : roll === 1
        ? [{ type: Move.id, payload: { dx: 1 } }]
        : []
  }
}

let rooms: LinkRoom[] = []
afterEach(async () => {
  for (const room of rooms) await room.dispose()
  rooms = []
})
async function start(options: Parameters<typeof linkRoom>[0]): Promise<LinkRoom> {
  const room = await linkRoom(options)
  rooms.push(room)
  await room.start()
  return room
}

/** Every snapshot the player restored carries the room's own hash for that tick. */
function expectRoomHashes(room: LinkRoom, player: LinkRoom['players'][number]): void {
  for (const restored of player.restored) expect(restored.hash).toBe(room.hashes.get(restored.tick))
}

describe('N-a: two clients over a rough link', () => {
  it('play 3,600 ticks with no hash mismatch, each command applied in its sim on the tick it was sampled', async () => {
    const sample = wander()
    const room = await start({ link: ROUGH, sample: (index) => sample(index) })
    const from = room.engine.tick
    await room.runFor(60_000)
    expect(room.engine.tick - from).toBeGreaterThanOrEqual(3_600)

    const late = room.logs.filter((event) => event.event === 'input.late').length
    for (const player of room.players) {
      expect(player.net.mismatches).toBe(0)
      expect(player.net.ended).toBeUndefined()
      // About one snapshot in fifty is lost on the way, and none fails its hash.
      expect(player.restored.length).toBeGreaterThan(1_000)
      expectRoomHashes(room, player)
      expect(player.sent.length).toBeGreaterThan(500)
      expect(player.offTick).toEqual([])
    }
    // And the room took nearly every one on that tick too: a late command is a correction, never a mismatch. The
    // only refusals are resends of a seq the room already had.
    const sent = room.players.reduce((sum, player) => sum + player.sent.length, 0)
    expect(late / sent).toBeLessThanOrEqual(0.05)
    const refusals = room.logs.flatMap((event) => (event.event === 'refused' ? [event.code] : []))
    expect(new Set(refusals)).toEqual(new Set(refusals.length > 0 ? ['sequence'] : []))
  })
})

describe('N-b: a dropped socket', () => {
  it('returns to its seat after 5 s and restores the next snapshot at the room hash; the room never paused', async () => {
    const sample = wander()
    const room = await start({ link: QUIET, sample: (index) => sample(index) })
    await room.runFor(5_000)
    const [, player] = room.players as [unknown, LinkRoom['players'][number]]
    const seat = player.client.seat()

    room.drop(player)
    const droppedAt = room.engine.tick
    const restoredBefore = player.restored.length
    await room.runFor(5_000)
    // The room stepped every tick of the five seconds, and the seat waited.
    expect(room.engine.tick - droppedAt).toBeGreaterThanOrEqual(299)
    expect(room.engine.lobby.phase).toBe('playing')
    expect(player.restored.length).toBe(restoredBefore)

    const back = room.engine.tick
    room.reconnect(player)
    await room.runFor(2_000)
    expect(player.client.seat()).toBe(seat)
    const next = player.restored[restoredBefore]
    expect(next?.tick).toBeGreaterThanOrEqual(back)
    expect(next?.hash).toBe(room.hashes.get(next?.tick as number))
    expectRoomHashes(room, player)
    expect(player.net.mismatches).toBe(0)
    // And it plays on: commands sampled after the return reached the room.
    const ack = player.sent.filter((command) => command.tick > back + 30)
    expect(ack.length).toBeGreaterThan(0)
    expect(player.net.pendingCommands.every((command) => command.tick > room.engine.tick - 60)).toBe(true)
  })
})

describe('N-d: a corrupted snapshot frame', () => {
  const corruptAfter = (room: LinkRoom, ms: number) => {
    const tick = room.engine.tick + Math.round((ms * 60) / 1000)
    return tick + (3 - (tick % 3))
  }

  it('is not stepped on, the next snapshot resyncs, and a second within 10 s ends the session with desync', async () => {
    const sample = wander()
    const room = await start({ link: QUIET, sample: (index) => sample(index) })
    const [player, other] = room.players as [LinkRoom['players'][number], LinkRoom['players'][number]]
    const first = corruptAfter(room, 2_000)
    player.corrupt.add(first)
    await room.runFor(3_000)

    expect(player.refused).toEqual([first])
    expect(player.restored.some((restored) => restored.tick === first)).toBe(false)
    const resync = player.restored.find((restored) => restored.tick > first)
    expect(resync?.hash).toBe(room.hashes.get(resync?.tick as number))
    expect(player.net.ended).toBeUndefined()

    const second = corruptAfter(room, 3_000)
    player.corrupt.add(second)
    await room.runFor(4_000)
    expect(player.refused).toEqual([first, second])
    expect(player.net.ended).toEqual({ reason: 'desync', tick: second })
    expect(player.restored.every((restored) => restored.tick < second)).toBe(true)
    // The other player was never affected.
    expect(other.net.mismatches).toBe(0)
    expect(other.net.ended).toBeUndefined()
  })

  it('does not end the session for two corrupted frames more than 10 s apart', async () => {
    const room = await start({ link: QUIET })
    const [player] = room.players as [LinkRoom['players'][number]]
    player.corrupt.add(corruptAfter(room, 1_000))
    player.corrupt.add(corruptAfter(room, 12_000))
    await room.runFor(14_000)
    expect(player.net.mismatches).toBe(2)
    expect(player.net.ended).toBeUndefined()
    expectRoomHashes(room, player)
  })
})
