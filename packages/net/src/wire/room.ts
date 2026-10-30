// The room contract a client reads (M7 spec §4.2, `RoomInfo`). net owns it; `server` imports it.

/** Characters a player can read off a screen and type without ambiguity: `I`, `O`, `0` and `1` are omitted. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Six characters (FloorFifty's `ROOM_CODE_LENGTH`). */
export const ROOM_CODE_LENGTH = 6

/** Where a room is: `RoomInfo.phase`. */
export const LOBBY_PHASES: readonly ['lobby', 'countdown', 'playing', 'ended'] = [
  'lobby',
  'countdown',
  'playing',
  'ended',
]
export type LobbyPhase = (typeof LOBBY_PHASES)[number]
