/**
 * The test room driver (FloorFifty `room-driver.ts`, generic; spec §4.3 `rooms/room-driver.ts` → `server/testing`).
 *
 * End-to-end tests need a game to move in seconds, and a browser test needs a screen to stay up on a slow machine.
 * The driver does both the only legitimate way: commands on the room's own input path (unmetered, because it
 * supplies one a tick; phase, schema, sequence and lead still apply), ticks by hand once the room's own clock is
 * stopped, and the clock hold (`clock-hold.ts`), which the room refuses in production. It cannot set a position, a
 * phase or a winner: if the sim does not produce one, the test does not get one.
 *
 * It takes a room, not a server: a test reaches the room through `@colyseus/testing`'s `getRoomById` (or an engine
 * directly). No HTTP endpoint is mounted for it.
 */

import type { RoomEngine } from '../room/room-engine'
import type { SeatInfoView, SubmitOutcome } from '../room/room-types'
import { type ClockName, isClockName } from '../rooms/clock-hold'
import type { QueuedInput } from '../rooms/input-queue'

/** The most ticks one `step` call drives: five minutes at 60 Hz. */
export const MAX_DRIVEN_TICKS: number = 60 * 60 * 5

/** What the driver needs of a room: its engine, its clock and one tick (`AutomataRoom` has all three). */
export interface DrivableRoom {
  readonly engine: RoomEngine
  stopClock(): void
  tick(): void
}

/** The room as it decided, read from the room itself and never from a client's copy. */
export interface RoomReading {
  readonly phase: string
  /** The tick the room steps next. */
  readonly tick: number
  readonly countdownEndsAtTick?: number
  readonly held: ClockName[]
  readonly hash: string
  readonly seats: readonly SeatInfoView[]
}

export interface RoomDriver {
  /** Stops the room's own clock for good, so no tick the test did not ask for lands between its assertions. */
  stopClock(): void
  step(count: number): void
  submit(seat: number, input: QueuedInput): SubmitOutcome
  read(): RoomReading
  /** Holds the named clocks and lets go of the rest. Refused in production; the whole list or nothing. */
  holdClocks(names: readonly ClockName[]): RoomReading
}

export function createRoomDriver(room: DrivableRoom): RoomDriver {
  const read = (): RoomReading => {
    const { engine } = room
    const ends = engine.lobby.countdownEndsAtTick
    return {
      phase: engine.lobby.phase,
      tick: engine.tick,
      ...(ends === undefined ? {} : { countdownEndsAtTick: ends }),
      held: engine.heldClocks,
      hash: engine.sim.hash(),
      seats: engine.info().seats,
    }
  }
  return {
    stopClock: () => room.stopClock(),
    step(count) {
      if (!Number.isInteger(count) || count < 0 || count > MAX_DRIVEN_TICKS)
        throw new Error(`a driver steps a whole number of ticks, at most ${MAX_DRIVEN_TICKS} at once`)
      for (let tick = 0; tick < count; tick += 1) room.tick()
    },
    submit: (seat, input) => room.engine.submit(seat, input, false),
    read,
    holdClocks(names) {
      if (!names.every(isClockName)) throw new Error('hold takes a list of clock names')
      room.engine.holdClocks(names)
      return read()
    },
  }
}
