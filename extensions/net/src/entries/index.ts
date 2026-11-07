// `@automata/net`: the wire (one owner; `net-server` imports it), the `net.toml` schema, and the client: the Colyseus
// transport, `NetRoom`, reconnection and the room store; prediction and reconciliation (`NetSession`) and the
// interpolation that draws the others. The sim side is `./sim`, the link harness and the fake SDK `./testing`.
export type { NetSnapshot, Pong } from '../features/client/room/colyseus-transport'
export { NetError, refusalCode } from '../features/client/room/net-error'
export type { ClientNetworkPort } from '../features/client/room/net-port'
export {
  type ConnectionState,
  createNetRoom,
  type IntentOptions,
  type NetRoom,
  type NetRoomOptions,
  type ResumeOutcome,
  type RoomEnd,
} from '../features/client/room/net-room'
export {
  RECONNECT_BASE_MS,
  RECONNECT_CEILING_MS,
  reconnectDelay,
} from '../features/client/room/reconnect-delay'
export type { RoomInfo, SeatInfo } from '../features/client/room/room-info'
export { createRoomStore, type RoomStore } from '../features/client/room/room-store'
export { colyseusClient, type NetSdkClient, type NetSdkRoom } from '../features/client/room/sdk'
export { SEAT_TOKEN_KEY, type SeatStorage, seatTokenKey } from '../features/client/room/seat-token'
export {
  type CreateNetSessionOptions,
  createNetSession,
  type NetSessionHandle,
} from '../features/client/session/create-net-session'
export {
  INITIAL_LEAD_TICKS,
  InputLead,
  type InputLeadOptions,
  leadForRoundTrip,
  MAX_LEAD_TICKS,
} from '../features/client/session/input-lead'
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
export { createWatchable, type Watchable, type WatchableSource } from '../shared/watchable'
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
