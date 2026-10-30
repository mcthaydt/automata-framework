// `@mcthaydt/automata-server`: the room rules as plain modules (M7 spec §4.3, M7.3a). The Colyseus room,
// `defineServer` and `startServer` arrive with M7.3b and adapt these, as FloorFifty's `race-room.ts` does.

export { addBot, botCount, botSeed, removeBot } from './rooms/bot-seats'
export {
  COMMAND_HISTORY,
  CommandLedger,
  type CommandResult,
  type LedgerAnswer,
  requestIdOf,
} from './rooms/command-ledger'
export { InputMeter, type InputMeterOptions } from './rooms/input-meter'
export {
  InputQueue,
  type InputQueueOptions,
  MAX_QUEUED_COMMANDS,
  type QueuedInput,
  type SubmitResult,
} from './rooms/input-queue'
export { type DrainableRoom, LiveRooms } from './rooms/live-rooms'
export {
  acceptsInput,
  countdownElapsed,
  createLobby,
  endGame,
  evaluateReadiness,
  isPreGame,
  type LobbyPhase,
  type LobbyRules,
  type LobbySeat,
  type LobbyState,
  nextHost,
  openSeat,
  removeSeat,
  seatPlayer,
  setConnected,
  setReady,
  startCountdown,
  startGame,
  startOver,
} from './rooms/lobby-rules'
export {
  CODE_ATTEMPTS,
  claimRoomCode,
  generateRoomCode,
  type RandomInt,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_CHANNEL,
  ROOM_CODE_LENGTH,
  type RoomCodeStore,
  releaseRoomCode,
} from './rooms/room-code'
export { RoomCommandError, type ServerError, toServerError } from './rooms/room-errors'
export { type FreedSeat, type SeatClient, SeatRegistry } from './rooms/seat-registry'
export {
  startTickScheduler,
  type TickClock,
  type TickScheduler,
  type TickSchedulerOptions,
} from './rooms/tick-scheduler'
