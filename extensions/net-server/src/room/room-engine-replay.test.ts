import { createReplayStepper, type Replay, unpackReplay } from '@mcthaydt/automata-sim/replay'
import { afterEach, describe, expect, it } from 'vitest'
import { defineServer, ROOM_SOURCE } from '../game/server-game'
import {
  type EngineHarness,
  engineHarness,
  type FakeClient,
  fakeClient,
} from '../test-support/engine-harness'
import { FIXTURE_CONTENT, fixtureGame, fixtureServer, Move } from '../test-support/fixture-game'
import { nodeReplayCompression } from './replay-compression'

// Bots, the replay and determinism (M7 spec §4.3 Bot seats and Replay, §4.4, §13 SV-e); FloorFifty race-room-cpus
// and race-room-replay, with the replay AF's own (`createRecorder`, `packReplay`).

let room: EngineHarness | undefined
afterEach(() => {
  room?.dispose()
  room = undefined
})

const cmd = (seq: number, tick: number, dx = 1) => ({ t: 'cmd', seq, tick, type: 'move', payload: { dx } })

/** Steps until play ends, moving `mover` one step right every other tick; returns the room's hash at the end. */
function playToTheEnd(harness: EngineHarness, mover?: FakeClient): string {
  let seq = 0
  for (let guard = 0; guard < 2_000; guard += 1) {
    if (harness.engine.lobby.phase === 'ended') return harness.sim.hash()
    if (mover !== undefined && guard % 2 === 0) {
      harness.send(mover, cmd(seq, harness.sim.tick))
      seq += 1
    }
    harness.steps(1)
  }
  throw new Error('play never ended')
}

async function replayOf(harness: EngineHarness): Promise<Replay> {
  const packed = harness.engine.replay
  if (packed === undefined) throw new Error('no replay was offered')
  return unpackReplay(await packed, nodeReplayCompression)
}

async function replayedHash(replay: Replay): Promise<string> {
  const stepper = await createReplayStepper(replay, {
    plugins: fixtureGame.plugins,
    content: FIXTURE_CONTENT,
  })
  const run = stepper.run()
  const hash = stepper.sim.hash()
  stepper.dispose()
  expect(run.ok).toBe(true)
  return hash
}

describe('bot seats', () => {
  it('refuses bot.add when the game has no policy', async () => {
    const { bots: _policy, ...withoutBots } = fixtureGame
    room = await engineHarness({ def: defineServer(withoutBots) })
    const ada = room.join('Ada')
    room.send(ada, { t: 'bot.add', req: 'b1' })
    expect(ada.of('answer')).toEqual([{ t: 'answer', req: 'b1', error: 'REFUSED' }])
    expect(room.engine.info().seats).toHaveLength(1)
  })

  it('seats one bot for a resent bot.add, for the host only', async () => {
    room = await engineHarness({ def: fixtureServer({ seats: { min: 2, max: 3 } }) })
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.send(bea, { t: 'bot.add', req: 'b1' })
    expect(bea.of('answer')).toEqual([{ t: 'answer', req: 'b1', error: 'REFUSED' }])
    room.send(ada, { t: 'bot.add', req: 'b2' })
    room.send(ada, { t: 'bot.add', req: 'b2' })
    expect(room.engine.info().seats).toEqual([
      { seat: 0, name: 'Ada', ready: false, connected: true, bot: false },
      { seat: 1, name: 'Bea', ready: false, connected: true, bot: false },
      { seat: 2, name: 'Bot 3', ready: true, connected: true, bot: true },
    ])
  })

  it('frees the seat on bot.remove, and the sim hears seat.leave', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.send(ada, { t: 'bot.add', req: 'b1' })
    room.steps(1)
    room.send(ada, { t: 'bot.remove', req: 'b2', seat: 1 })
    room.steps(1)
    expect(ada.of('answer').at(-1)).toEqual({ t: 'answer', req: 'b2' })
    expect(room.engine.info().seats).toHaveLength(1)
  })
})

describe('the replay', () => {
  it('SV-e: a bot in a 2-seat room plays under its own seat, and the replay gives the room its final hash', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.send(ada, { t: 'bot.add', req: 'b1' })
    room.startPlay(ada)
    const finalHash = playToTheEnd(room)
    const replay = await replayOf(room)

    const botMoves = replay.ticks.flatMap((entry) =>
      entry.commands.filter((command) => command.type === Move.id && command.source === 1),
    )
    expect(botMoves.length).toBeGreaterThan(0)
    expect(replay.finalHash).toBe(finalHash)
    expect(await replayedHash(replay)).toBe(finalHash)

    // Offered to every client at the end: the header, then the bytes.
    const header = ada.inbox.findIndex((entry) => 'message' in entry && entry.message.t === 'replay')
    expect(ada.inbox[header + 1]).toEqual({ bytes: await room.engine.replay })
  })

  it('records every command the room applied (seats, spawns, people, bots), through a drop and a leave', async () => {
    room = await engineHarness({ def: fixtureServer({ seats: { min: 2, max: 3 } }) })
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.steps(2)
    room.engine.leave(bea.session)
    room.send(ada, { t: 'bot.add', req: 'b1' })
    room.startPlay(ada)
    room.send(ada, cmd(0, room.sim.tick))
    room.steps(2)
    room.engine.drop(ada.session)
    room.steps(3)
    const back = fakeClient(ada.session)
    room.engine.reconnect(ada.session, back)
    room.steps(1)
    room.send(back, cmd(1, room.sim.tick))
    const finalHash = playToTheEnd(room)
    const replay = await replayOf(room)

    const sources = new Set(replay.ticks.flatMap((entry) => entry.commands.map((command) => command.source)))
    expect([...sources].sort((a, b) => a - b)).toEqual([0, 1, ROOM_SOURCE])
    const roomTypes = replay.ticks.flatMap((entry) =>
      entry.commands.filter((command) => command.source === ROOM_SOURCE).map((command) => command.type),
    )
    expect(roomTypes).toEqual([
      'seat.join',
      'avatar.spawn',
      'seat.join',
      'avatar.spawn',
      'seat.leave',
      'seat.join',
      'avatar.spawn',
    ])
    expect(await replayedHash(replay)).toBe(finalHash)
  })

  it('starts a new recording on play again, from where the last game left the sim', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.send(ada, { t: 'bot.add', req: 'b1' })
    room.startPlay(ada)
    playToTheEnd(room)
    const first = await replayOf(room)
    room.send(ada, { t: 'ready', ready: true, req: 'again' })
    expect(room.engine.replay).toBeUndefined()
    for (let guard = 0; guard < 100 && room.engine.lobby.phase !== 'playing'; guard += 1) room.steps(1)
    const finalHash = playToTheEnd(room)
    const second = await replayOf(room)
    expect(second.header.startTick).toBe(first.finalTick)
    expect(await replayedHash(second)).toBe(finalHash)
  })
})

describe('draining', () => {
  it('closes a lobby at once and seats nobody new', async () => {
    room = await engineHarness()
    room.join('Ada')
    room.engine.beginDrain()
    expect(room.closes).toEqual(['drained'])
    expect(() => room?.engine.admit()).toThrow(/updating/)
  })

  it('lets a game play to its end, and closes when the room would go back to its lobby', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    room.send(ada, { t: 'bot.add', req: 'b1' })
    room.startPlay(ada)
    room.engine.beginDrain()
    playToTheEnd(room)
    room.steps(5)
    expect(room.closes).toEqual([])
    room.send(ada, { t: 'ready', ready: true, req: 'again' })
    expect(room.closes).toEqual(['drained'])
    expect(room.engine.lobby.phase).toBe('ended')
  })
})

describe('the clock hold', () => {
  it('keeps a held countdown from ending, and is refused in production', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.engine.holdClocks(['countdown'])
    room.send(ada, { t: 'ready', ready: true, req: 'r1' })
    room.send(bea, { t: 'ready', ready: true, req: 'r1' })
    room.steps(30)
    expect(room.engine.lobby.phase).toBe('countdown')
    room.engine.holdClocks([])
    room.steps(3)
    expect(room.engine.lobby.phase).toBe('playing')

    const production = await engineHarness({ env: { NODE_ENV: 'production' } })
    expect(() => production.engine.holdClocks(['countdown'])).toThrow(/production/)
    production.dispose()
  })
})
