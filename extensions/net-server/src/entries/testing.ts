// `@automata/net-server/testing`: the room driver and the clock hold, for tests only.
// The room refuses a clock hold in production; process safety refuses to start with a test switch set, the fake
// session verifier included.

export {
  CLOCK_NAMES,
  type ClockName,
  HELD_GRACE_SECONDS,
  holdAllowed,
  isClockName,
} from '../features/room/rules/clock-hold'
export { createFakeVerifier, type FakeVerifier } from '../shared/session-verifier'
export {
  createRoomDriver,
  type DrivableRoom,
  MAX_DRIVEN_TICKS,
  type RoomDriver,
  type RoomReading,
} from '../testing/room-driver'
