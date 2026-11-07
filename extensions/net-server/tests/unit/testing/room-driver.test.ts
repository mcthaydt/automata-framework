import { afterEach, describe, expect, it } from 'vitest'
import { type EngineHarness, engineHarness } from '#src/testing/engine-harness.ts'
import { positions } from '#src/testing/fixture-game.ts'
import { createRoomDriver, MAX_DRIVEN_TICKS, type RoomDriver } from '#src/testing/room-driver.ts'

// The test driver: a test drives a room the only legitimate way, with commands
// on the room's own path and ticks by hand. It cannot set a position, a phase or a winner.

let room: EngineHarness | undefined
afterEach(() => {
  room?.dispose()
  room = undefined
})

function driverOf(harness: EngineHarness): RoomDriver {
  let stopped = 0
  const driver = createRoomDriver({
    engine: harness.engine,
    stopClock: () => {
      stopped += 1
    },
    tick: () => harness.engine.step(),
  })
  driver.stopClock()
  expect(stopped).toBe(1)
  return driver
}

describe('the room driver', () => {
  it('steps a room by hand and reads what the room decided', async () => {
    room = await engineHarness()
    room.join('Ada')
    const driver = driverOf(room)
    driver.step(4)
    expect(driver.read()).toEqual({
      phase: 'lobby',
      tick: 4,
      held: [],
      hash: room.sim.hash(),
      seats: [{ seat: 0, name: 'Ada', ready: false, connected: true, bot: false }],
    })
  })

  it("submits on the room's real path, unmetered: the phase, the schema and the sequence still apply", async () => {
    room = await engineHarness({ commandsPerSeat: { burst: 1, perSecond: 0 } })
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    const driver = driverOf(room)
    expect(driver.submit(0, { seq: 0, tick: 0, type: 'move', payload: { dx: 1 } })).toBe('phase')
    room.startPlay(ada, bea)
    const tick = room.sim.tick
    for (let seq = 0; seq < 3; seq += 1)
      expect(driver.submit(0, { seq, tick, type: 'move', payload: { dx: 1 } })).toBe('accepted')
    expect(driver.submit(0, { seq: 3, tick, type: 'move', payload: { dx: 9 } })).toBe('payload')
    expect(driver.submit(0, { seq: 1, tick, type: 'move', payload: { dx: 1 } })).toBe('sequence')
    driver.step(1)
    expect(positions(room.sim)[0]).toBe(3)
  })

  it('holds the countdown for as long as a test needs, and only names clocks the room has', async () => {
    room = await engineHarness()
    const ada = room.join('Ada')
    const bea = room.join('Bea')
    const driver = driverOf(room)
    expect(driver.holdClocks(['countdown']).held).toEqual(['countdown'])
    room.send(ada, { t: 'ready', ready: true, req: 'r' })
    room.send(bea, { t: 'ready', ready: true, req: 'r' })
    driver.step(20)
    expect(driver.read().phase).toBe('countdown')
    expect(() => driver.holdClocks(['select' as never])).toThrow(/clock/)
    expect(driver.read().held).toEqual(['countdown'])
  })

  it('refuses a clock hold in production', async () => {
    room = await engineHarness({ env: { NODE_ENV: 'production' } })
    expect(() => driverOf(room as EngineHarness).holdClocks(['countdown'])).toThrow(/production/)
  })

  it('refuses to drive past its bound in one call, so a bad call cannot hang the server', async () => {
    room = await engineHarness()
    expect(() => driverOf(room as EngineHarness).step(MAX_DRIVEN_TICKS + 1)).toThrow(/at most/)
  })
})
