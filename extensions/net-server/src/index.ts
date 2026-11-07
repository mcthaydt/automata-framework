// `@automata/net-server` (M7 spec §4.3): a game's server (`defineServer`), the process (`startServer`,
// `runServerProcess`), the generic Colyseus room that adapts the room rules (M7.3b), the rules themselves as plain
// modules (M7.3a), the gates in front of Colyseus (M7.4a), and operations (M7.4b: log lines, probes, process safety,
// `SessionVerifier`). The test driver, the clock hold and the fake verifier are `./testing`.

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
export { ANOMALY_COOLDOWN_MS, createAnomalyLimiter, slowStepMs } from './rooms/room-telemetry'
export { type FreedSeat, type SeatClient, SeatRegistry } from './rooms/seat-registry'
export {
  startTickScheduler,
  type TickClock,
  type TickScheduler,
  type TickSchedulerOptions,
} from './rooms/tick-scheduler'
export { DRAIN_MAX_MS, type DrainResult } from './server/drain'
export {
  type ColyseusLogger,
  colyseusLogger,
  createLogWriter,
  type LogWriterOptions,
  levelOf,
  toLogLine,
} from './server/log-writer'
export {
  answerProbe,
  installProbes,
  PROBE_HEADERS,
  type ProbeState,
  type Readiness,
  type SecurityTxt,
  securityTxtBody,
} from './server/probes'
export { type CrashTarget, installCrashHandlers, testSwitchesSet } from './server/process-safety'
export { type LogLevel, type ServerLogLine, serverLogLine } from './server/server-log-line.schema'
export {
  type EnvConfigResult,
  type EnvServerBase,
  runServerProcess,
  type ServerProcessOptions,
  serverConfigFromEnv,
} from './server/server-process'
export {
  createServerRuntime,
  type ServerRuntime,
  ServerStartError,
  startServer,
  tickClockFrom,
} from './server/start-server'
export {
  anonymousVerifier,
  isTestVerifier,
  SessionRejected,
  type SessionRejectReason,
  type SessionVerifier,
  type VerifiedSession,
} from './session/session-verifier'
