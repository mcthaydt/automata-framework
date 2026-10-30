// `@mcthaydt/automata-net`: the wire (one owner; `server` imports it) and the `net.toml` schema (M7 spec §4.2).
// The Colyseus transport, NetRoom and prediction arrive with M7.5; the sim side is `./sim`, the link harness
// `./testing`.
export { type NetConfig, type NetConfigInput, netConfigSchema } from './config/net.schema'
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
  NET_ERROR_CODES,
  type NetErrorCode,
  type ServerMessage,
  serverMessageSchema,
} from './wire/server-message.schema'
