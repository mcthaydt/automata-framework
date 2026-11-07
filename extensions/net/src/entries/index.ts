// `@automata/net`: the wire (one owner; `server` imports it), the `net.toml` schema, and the client (M7 spec
// §4.2): the Colyseus transport, `NetRoom`, reconnection and the room store (M7.5a); prediction and reconciliation,
// `NetSession` (M7.5b). Interpolation arrives with M7.5c; the sim side is `./sim`, the link harness and the fake SDK `./testing`.

export {
  MAX_DELAY_SECONDS,
  RenderClock,
  type RenderClockOptions,
} from '../features/client/interpolation/render-clock'
export {
  type BlendOptions,
  blendViews,
  type RemoteFields,
  type RemoteView,
  SnapshotBuffer,
  type SnapshotBufferOptions,
} from '../features/client/interpolation/snapshot-buffer'
export type { NetSnapshot, Pong } from '../features/client/room/colyseus-transport'
export { NetError, refusalCode } from '../features/client/room/net-error'
export type { ClientNetworkPort } from '../features/client/room/net-port'
export {
  type ConnectionState,
  makeNetRoom,
  NetRoom,
  type NetRoomOptions,
  netRoomLayer,
  type ResumeOutcome,
  type RoomEnd,
} from '../features/client/room/net-room'
export {
  RECONNECT_BASE_MS,
  RECONNECT_CEILING_MS,
  reconnectDelay,
} from '../features/client/room/reconnect-delay'
export type { RoomInfo, SeatInfo } from '../features/client/room/room-info'
export { makeRoomStore, type RoomStore } from '../features/client/room/room-store'
export { colyseusClient, type NetSdkClient, type NetSdkRoom } from '../features/client/room/sdk'
export { SEAT_TOKEN_KEY, type SeatStorage, seatTokenKey } from '../features/client/room/seat-token'
export {
  INITIAL_LEAD_TICKS,
  InputLead,
  type InputLeadOptions,
  leadForRoundTrip,
  MAX_LEAD_TICKS,
} from '../features/client/session/input-lead'
export {
  type MakeNetSessionOptions,
  makeNetSession,
  type NetSessionHandle,
} from '../features/client/session/make-net-session'
export {
  DEFAULT_DEGRADED,
  type DegradedThresholds,
  Distribution,
  type DistributionSummary,
  NetDiagnostics,
  type NetDiagnosticsOptions,
  type NetSummary,
} from '../features/client/session/net-diagnostics'
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
} from '../features/client/session/net-session'
export { type NetConfig, type NetConfigInput, netConfigSchema } from '../shared/net.schema'
export { type ClientMessage, clientMessageSchema } from '../shared/wire/client-message.schema'
export { type JoinOptions, joinOptionsSchema } from '../shared/wire/join-options.schema'
export {
  COMMAND_TYPE_MAX_LENGTH,
  MAX_MESSAGE_BYTES,
  MAX_SEATS,
  PLAYER_NAME_MAX_LENGTH,
  PROTOCOL_VERSION,
  REQUEST_ID_MAX_LENGTH,
  SESSION_MAX_LENGTH,
} from '../shared/wire/limits'
export { type ParseResult, parseClientMessage, parseServerMessage } from '../shared/wire/parse'
export {
  commandTypeSchema,
  hex16Schema,
  nameSchema,
  reqIdSchema,
  seatSchema,
  uintSchema,
} from '../shared/wire/primitives.schema'
export {
  LOBBY_PHASES,
  type LobbyPhase,
  NET_BYTES_CHANNEL,
  NET_CHANNEL,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_NAME,
} from '../shared/wire/room'
export {
  NET_ERROR_CODES,
  type NetErrorCode,
  type ServerMessage,
  serverMessageSchema,
} from '../shared/wire/server-message.schema'
