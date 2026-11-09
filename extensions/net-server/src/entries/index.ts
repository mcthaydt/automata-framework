// `@automata/net-server`: a game's server (`defineServer`), the process (`startServer`,
// `runServerProcess`), the generic Colyseus room that adapts the room rules, the rules themselves as plain
// modules, the gates in front of Colyseus, and operations. The test driver, the clock hold and the fake verifier are `./testing`.

export {
  type EnvConfigResult,
  type EnvServerBase,
  runServerProcess,
  type ServerProcessOptions,
  serverConfigFromEnv,
} from '../app/server-process'
export {
  createServerRuntime,
  type ServerRuntime,
  ServerStartError,
  startServer,
  tickClockFrom,
} from '../app/start-server'
export { clientIp } from '../features/gates/client-ip'
export { readCappedBody, refuseTooLarge } from '../features/gates/http-body'
export {
  createMatchmakeGate,
  type MatchmakeGate,
  type MatchmakeGateOptions,
  RATE_BUCKET_MAX_KEYS,
} from '../features/gates/matchmake-gate'
export { type OriginPolicy, originPolicy, originsFromGameOrigin } from '../features/gates/origins'
export { REFUSAL_WORDS } from '../features/gates/refusal'
export { type GateOptions, installGates } from '../features/gates/server-gates'
export {
  createSocketGate,
  SOCKET_HEADROOM,
  type SocketGate,
  socketTotal,
} from '../features/gates/socket-gate'
export { bucketOptions, type TokenBucketOptions, TokenBuckets } from '../features/gates/token-buckets'
export { createUpgradeGate, type UpgradeGate, type UpgradeGateOptions } from '../features/gates/upgrade-gate'
export { DRAIN_MAX_MS, type DrainResult } from '../features/operations/drain'
export {
  type ColyseusLogger,
  colyseusLogger,
  createLogWriter,
  type LogWriterOptions,
  levelOf,
  toLogLine,
} from '../features/operations/log-writer'
export {
  answerProbe,
  installProbes,
  PROBE_HEADERS,
  type ProbeState,
  type Readiness,
  securityTxtBody,
} from '../features/operations/probes'
export {
  type CrashTarget,
  installCrashHandlers,
  testSwitchesSet,
} from '../features/operations/process-safety'
export {
  type LogLevel,
  type ServerLogLine,
  serverLogLine,
} from '../features/operations/server-log-line.schema'
export { AutomataRoom } from '../features/room/engine/automata-room'
export { addBot, botCount, botSeed, removeBot } from '../features/room/rules/bot-seats'
export {
  COMMAND_HISTORY,
  CommandLedger,
  type CommandResult,
  type LedgerAnswer,
  requestIdOf,
} from '../features/room/rules/command-ledger'
export { InputMeter, type InputMeterOptions } from '../features/room/rules/input-meter'
export {
  InputQueue,
  type InputQueueOptions,
  MAX_QUEUED_COMMANDS,
  type QueuedInput,
  type SubmitResult,
} from '../features/room/rules/input-queue'
export { type DrainableRoom, LiveRooms } from '../features/room/rules/live-rooms'
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
} from '../features/room/rules/lobby-rules'
export {
  CODE_ATTEMPTS,
  claimRoomCode,
  generateRoomCode,
  type RandomInt,
  ROOM_CODE_CHANNEL,
  type RoomCodeStore,
  releaseRoomCode,
} from '../features/room/rules/room-code'
export { RoomCommandError, type ServerError, toServerError } from '../features/room/rules/room-errors'
export { ANOMALY_COOLDOWN_MS, createAnomalyLimiter, slowStepMs } from '../features/room/rules/room-telemetry'
export { type FreedSeat, type SeatClient, SeatRegistry } from '../features/room/rules/seat-registry'
export {
  startTickScheduler,
  type TickClock,
  type TickScheduler,
  type TickSchedulerOptions,
} from '../features/room/rules/tick-scheduler'
export type {
  Bucket,
  RoomLogEvent,
  SecurityTxt,
  ServerConfig,
  ServerLimits,
  SignalSource,
} from '../shared/game/server-config'
export {
  type BotPolicy,
  type CommandIntent,
  defineServer,
  ROOM_SOURCE,
  type ServerDef,
  type ServerGameDef,
} from '../shared/game/server-game'
export { type ReadonlyEntity, type SimView, simViewOf } from '../shared/game/sim-view'
export { type GameVersion, gameVersionOf, versionVerdict } from '../shared/game-version'
export {
  anonymousVerifier,
  isTestVerifier,
  SessionRejected,
  type SessionRejectReason,
  type SessionVerifier,
  type VerifiedSession,
} from '../shared/session-verifier'
