import { ROOM_NAME } from '@automata/net'
import { netPlugin } from '@automata/net/sim'
import { definePlugin } from '@automata/sim'
import { CloseCode } from '@colyseus/core'
import { Effect } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { defineServer } from '../game/server-game'
import { startTestServer, type TestServer, waitFor } from '../test-support/colyseus-harness'
import { fixtureGame, fixtureServer, walkPlugin } from '../test-support/fixture-game'
import type { AutomataRoom } from './automata-room'

// Review of M7.3b on Colyseus: a game that throws on the tick halts its own room only; a drain that starts while a
// room is being created reaches that room; the harness's rooms never tick on their own.

let server: TestServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

describe('a room whose game throws on the tick', () => {
  it('closes with an error and logs it, and the server’s other rooms keep ticking', async () => {
    server = await startTestServer({
      def: fixtureServer({
        bots: {
          name: 'broken',
          commands: () => {
            throw new Error('the bot threw')
          },
        },
      }),
    })
    const broken = await server.create('Ada')
    const host = await server.create('Bea')
    const guest = await server.joinById(host.code, 'Cy')
    broken.send({ t: 'bot.add', req: 'b' })
    broken.send({ t: 'ready', ready: true, req: 'r' })
    await waitFor(() => broken.of('answer').length === 2, 'the broken room never answered')
    await server.step(broken.code, 6)
    await waitFor(() => broken.closedWith !== undefined, 'the broken room never closed')
    expect(broken.closedWith).toBe(CloseCode.WITH_ERROR)
    expect(server.logs).toContainEqual({ event: 'room.error', code: 'Error', room: expect.any(String) })

    const before = guest.of('snap').length
    await server.step(host.code, 3)
    await waitFor(() => guest.of('snap').length > before, 'the other room stopped ticking')
  })
})

describe('a drain that starts while a room is being created', () => {
  it('reaches that room: its creation is refused SERVER_UPDATING and it is gone at once, not after a grace', async () => {
    let open: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      open = resolve
    })
    // A plugin whose engine takes its time, so the drain starts between the room's registration and its engine.
    // The server builds one sim of the game at start to read its version (M7.4a); only the room's sim waits.
    let sims = 0
    const slow = definePlugin({
      name: 'slow',
      state: async () => {
        sims += 1
        if (sims > 1) await gate
        return {
          snapshot: () => new Uint8Array(),
          prepareRestore: () => ({ commit: () => undefined, discard: () => undefined }),
          dispose: () => undefined,
        }
      },
    })
    server = await startTestServer({
      def: defineServer({ ...fixtureGame, plugins: [netPlugin, walkPlugin, slow] }),
      config: { drainCapMs: 60_000 },
    })
    const test = server
    const created = test.colyseus.sdk.create(ROOM_NAME, test.joinOptions('Ada'))
    await waitFor(() => test.runtime.rooms.size === 1, 'the room never registered')
    const drained = Effect.runPromise(test.runtime.drain)
    open()
    await expect(created).rejects.toThrow(/SERVER_UPDATING/)
    expect(test.runtime.rooms.size).toBe(0)
    expect(await drained).toBe('empty')
  })
})

describe('the harness clock', () => {
  it('never lets a room tick on its own, so a test counts every tick', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    // Read without the harness's `room`, which stops the clock: the room must never have started one.
    const room = server.colyseus.getRoomById(host.code) as unknown as AutomataRoom
    const tick = room.engine.tick
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(room.engine.tick).toBe(tick)
    expect(tick).toBe(1)
  })
})
