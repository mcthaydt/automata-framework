// `@mcthaydt/automata-net`: the wire (one owner; `server` imports it), the `net.toml` schema, and the client (M7 spec
// §4.2): the Colyseus transport, `NetRoom`, reconnection and the room store (M7.5a); prediction and reconciliation,
// `NetSession` (M7.5b). Interpolation arrives with M7.5c; the sim side is `./sim`, the link harness and the fake SDK `./testing`.
export type { NetSnapshot, Pong } from './client/colyseus-transport'
export { NetError, refusalCode } from './client/net-error'
export type { ClientNetworkPort } from './client/net-port'
export {
  type ConnectionState,
  makeNetRoom,
  NetRoom,
  type NetRoomOptions,
  netRoomLayer,
  type ResumeOutcome,
  type RoomEnd,
} from './client/net-room'
export { RECONNECT_BASE_MS, RECONNECT_CEILING_MS, reconnectDelay } from './client/reconnect-delay'
export type { RoomInfo, SeatInfo } from './client/room-info'
export { makeRoomStore, type RoomStore } from './client/room-store'
export { colyseusClient, type NetSdkClient, type NetSdkRoom } from './client/sdk'
export { SEAT_TOKEN_KEY, type SeatStorage, seatTokenKey } from './client/seat-token'
export { type NetConfig, type NetConfigInput, netConfigSchema } from './config/net.schema'
export {
  INITIAL_LEAD_TICKS,
  InputLead,
  type InputLeadOptions,
  leadForRoundTrip,
  MAX_LEAD_TICKS,
} from './session/input-lead'
export { type MakeNetSessionOptions, makeNetSession, type NetSessionHandle } from './session/make-net-session'
export {
  DEFAULT_DEGRADED,
  type DegradedThresholds,
  Distribution,
  type DistributionSummary,
  NetDiagnostics,
  type NetDiagnosticsOptions,
  type NetSummary,
} from './session/net-diagnostics'
export {
  DESYNC_WINDOW_MS,
  type LocalCommand,
  MAX_CATCH_UP_TICKS,
  MAX_PENDING_COMMANDS,
  type NetFrame,
  NetSession,
  type NetSessionOptions,
  PING_EVERY_MS,
  type RemoteSource,
  type Sampler,
  type SessionEnd,
  type SessionRoomState,
} from './session/net-session'
export { MAX_DELAY_SECONDS, RenderClock, type RenderClockOptions } from './session/render-clock'
export {
  type BlendOptions,
  blendViews,
  type RemoteFields,
  type RemoteView,
  SnapshotBuffer,
  type SnapshotBufferOptions,
} from './session/snapshot-buffer'
export { type ClientMessage, clientMessageSchema } from './wire/client-message.schema'
export { type JoinOptions, joinOptionsSchema } from './wire/join-options.schema'
export {
  COMMAND_TYPE_MAX_LENGTH,
  MAX_MESSAGE_BYTES,
  MAX_SEATS,
  PLAYER_NAME_MAX_LENGTH,
  PROTOCOL_VERSION,
  REQUEST_ID_MAX_LENGTH,
  SESSION_MAX_LENGTH,
} from './wire/limits'
export { type ParseResult, parseClientMessage, parseServerMessage } from './wire/parse'
export {
  commandTypeSchema,
  hex16Schema,
  nameSchema,
  reqIdSchema,
  seatSchema,
  uintSchema,
} from './wire/primitives.schema'
export {
  LOBBY_PHASES,
  type LobbyPhase,
  NET_BYTES_CHANNEL,
  NET_CHANNEL,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_NAME,
} from './wire/room'
export {
  NET_ERROR_CODES,
  type NetErrorCode,
  type ServerMessage,
  serverMessageSchema,
} from './wire/server-message.schema'
