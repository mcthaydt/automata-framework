// The room contract a client reads. net owns it; `server` imports it.

/** Characters a player can read off a screen and type without ambiguity: `I`, `O`, `0` and `1` are omitted. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Six characters. */
export const ROOM_CODE_LENGTH = 6

/** Where a room is: `RoomInfo.phase`. */
export const LOBBY_PHASES: readonly ['lobby', 'countdown', 'playing', 'ended'] = [
  'lobby',
  'countdown',
  'playing',
  'ended',
]
/** Where a room is: in the lobby, counting down, playing or ended. */
export type LobbyPhase = (typeof LOBBY_PHASES)[number]

/** The Colyseus room type a client creates, joins and finds (`create`, `joinById`, `joinOrCreate`). */
export const ROOM_NAME = 'automata'

/**
 * The channel every wire message travels on as JSON text, both ways: a `ClientMessage` from a client and a
 * `ServerMessage` from the room. Text, so the room measures a message before it parses it.
 */
export const NET_CHANNEL = 'net'

/** The channel the binary that follows a `snap` or `replay` header travels on: snapshot or packed replay bytes. */
export const NET_BYTES_CHANNEL = 'net.bytes'
