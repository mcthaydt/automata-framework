// `@mcthaydt/automata-server` (M7 spec §4.3): a game's server (`defineServer`), the process (`startServer`), the
// generic Colyseus room that adapts the room rules (M7.3b), the rules themselves as plain modules (M7.3a), and the
// gates in front of Colyseus (M7.4a). The test driver and the clock hold are `./testing`.

export type { Bucket, RoomLogEvent, ServerConfig, ServerLimits, SignalSource } from './game/server-config'
export {
  type BotPolicy,
  type CommandIntent,
  defineServer,
  ROOM_SOURCE,
  type ServerDef,
  type ServerGameDef,
} from './game/server-game'
export { type ReadonlyEntity, type SimView, simViewOf } from './game/sim-view'
export { clientIp } from './gate/client-ip'
export { readCappedBody, refuseTooLarge } from './gate/http-body'
export {
  createMatchmakeGate,
  type MatchmakeGate,
  type MatchmakeGateOptions,
  RATE_BUCKET_MAX_KEYS,
} from './gate/matchmake-gate'
export { type GameVersion, gameVersionOf, versionVerdict } from './gate/matchmake-version-gate'
export { type OriginPolicy, originPolicy, originsFromGameOrigin } from './gate/origins'
export { REFUSAL_WORDS } from './gate/refusal'
export { type GateOptions, installGates } from './gate/server-gates'
export { createSocketGate, SOCKET_HEADROOM, type SocketGate, socketTotal } from './gate/socket-gate'
export { bucketOptions, type TokenBucketOptions, TokenBuckets } from './gate/token-buckets'
export { createUpgradeGate, type UpgradeGate, type UpgradeGateOptions } from './gate/upgrade-gate'
export { AutomataRoom } from './room/automata-room'
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
  ROOM_CODE_CHANNEL,
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
export { DRAIN_MAX_MS, type DrainResult } from './server/drain'
export {
  createServerRuntime,
  type ServerRuntime,
  ServerStartError,
  startServer,
  tickClockFrom,
} from './server/start-server'
