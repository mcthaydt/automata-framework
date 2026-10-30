// `@mcthaydt/automata-server/testing`: the room driver and the clock hold, for tests only (M7 spec §4.3, §4.7).
// The room refuses a clock hold in production; process safety refuses to start with a test switch set, the fake
// session verifier included (M7.4b).

export {
  CLOCK_NAMES,
  type ClockName,
  HELD_GRACE_SECONDS,
  holdAllowed,
  isClockName,
} from '../rooms/clock-hold'
export { createFakeVerifier, type FakeVerifier } from '../session/session-verifier'
export {
  createRoomDriver,
  type DrivableRoom,
  MAX_DRIVEN_TICKS,
  type RoomDriver,
  type RoomReading,
} from './room-driver'
