// The wire's bounds (M7 spec §4.2, §13 SV-a). One owner: `server` imports these, it never restates them.

/** Bumped when a message shape changes; a room refuses a join on another version. */
export const PROTOCOL_VERSION = 1
/** The size cap: a message past it is dropped before it is parsed (SV-a). */
export const MAX_MESSAGE_BYTES = 16_384
/** FloorFifty's bound (`packages/shared/src/common/constants.ts` at 677d456). */
export const REQUEST_ID_MAX_LENGTH = 64
/** FloorFifty's bound (`PLAYER_NAME_MAX_LENGTH`). */
export const PLAYER_NAME_MAX_LENGTH = 16
/** Seats are 0 to MAX_SEATS - 1 (the sim side owns the bound). */
export { MAX_SEATS } from '../sim/seat.schema'
/** A reconnection session token, opaque to the client. */
export const SESSION_MAX_LENGTH = 128
/** The longest sim command type a client may name. */
export const COMMAND_TYPE_MAX_LENGTH = 64
