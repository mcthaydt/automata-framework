import { afterEach, describe, expect, it } from 'vitest'
import { type EngineHarness, engineHarness, fakeClient } from '#src/testing/engine-harness.ts'
import { fixtureServer, walkingBot } from '#src/testing/fixture-game.ts'

// A game that throws on the tick, stale acks after a reload, a bucket refilled by reconnecting and a
// replay that fails to pack. Each case is a defect the first build had.

let room: EngineHarness | undefined
afterEach(() => {
  room?.dispose()
  room = undefined
})

const cmd = (seq: number, tick: number) => ({ t: 'cmd', seq, tick, type: 'move', payload: { dx: 1 } })

describe('a game that throws on the tick', () => {
  it('halts the room when its bot policy throws: the error is logged and the room asks to close', async () => {
    room = await engineHarness({
      def: fixtureServer({
        bots: {
          name: 'broken',
          commands: () => {
            throw new Error('the bot threw')
          },
        },
      }),
    })
    const ada = room.join('Ada')
    room.send(ada, { t: 'bot.add', req: 'b' })
    room.send(ada, { t: 'ready', ready: true, req: 'r' })
    const harness = room
    expect(() => harness.steps(10)).not.toThrow()
    expect(room.logs).toContainEqual({ event: 'room.error', code: 'Error' })
    expect(room.closes).toEqual(['failed'])
    const tick = room.sim.tick
    room.steps(3)
    expect(room.sim.tick).toBe(tick)
  })

  it("halts the room when the game's ended hook throws", async () => {
    room = await engineHarness({
      def: fixtureServer({
        bots: walkingBot,
        ended: () => {
          throw new TypeError('ended threw')
        },
      }),
    })
    const ada = room.join('Ada')
    room.send(ada, { t: 'bot.add', req: 'b' })
    room.send(ada, { t: 'ready', ready: true, req: 'r' })
    const harness = room
    expect(() => harness.steps(10)).not.toThrow()
    expect(room.logs).toContainEqual({ event: 'room.error', code: 'TypeError' })
    expect(room.closes).toEqual(['failed'])
  })
})

describe('acks and budgets across a return', () => {
  it('acks a reloaded seat from its new numbering, never the old high seq', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.startPlay(ada, bea)
    // Three steps, short of the goal of five, so play goes on.
    for (let seq = 0; seq < 3; seq += 1) room.send(ada, cmd(seq, room.sim.tick))
    room.steps(1)
    room.engine.drop(ada.session)
    const reloaded = fakeClient(ada.session)
    room.engine.reconnect(ada.session, reloaded)
    // Stamped ten ticks on, so the next snapshot goes out while the new seq 0 is still queued.
    room.send(reloaded, cmd(0, room.sim.tick + 10))
    room.steps(3)
    expect(reloaded.of('snap').at(-1)?.acks['0']).toBeUndefined()
    room.steps(9)
    expect(reloaded.of('snap').at(-1)?.acks['0']).toBe(0)
  })

  it('keeps the remaining credit over a drop and a return: cycling them earns no extra burst', async () => {
    room = await engineHarness({ commandsPerSeat: { burst: 2, perSecond: 0 } })
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    room.startPlay(ada, bea)
    room.send(ada, cmd(0, room.sim.tick))
    room.send(ada, cmd(1, room.sim.tick))
    room.engine.drop(ada.session)
    const back = fakeClient(ada.session)
    room.engine.reconnect(ada.session, back)
    room.send(back, cmd(2, room.sim.tick))
    room.steps(1)
    expect(room.logs).toContainEqual({ event: 'refused', seat: 0, code: 'rate' })
  })
})

describe('a replay that fails to pack', () => {
  it('is logged, at the end and again for a client that returns, and never rejects unhandled', async () => {
    room = await engineHarness({
      compression: {
        deflate: () => Promise.reject(new Error('no deflate')),
        inflate: () => Promise.reject(new Error('no inflate')),
      },
    })
    const ada = room.join('Ada')
    room.send(ada, { t: 'bot.add', req: 'b' })
    room.startPlay(ada)
    for (let guard = 0; guard < 600 && room.engine.lobby.phase !== 'ended'; guard += 1) room.steps(1)
    expect(room.engine.lobby.phase).toBe('ended')
    room.engine.drop(ada.session)
    room.engine.reconnect(ada.session, fakeClient(ada.session))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(room.logs.filter((event) => event.event === 'replay.failed')).toHaveLength(2)
  })
})
