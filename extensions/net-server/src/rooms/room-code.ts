/**
 * Room identity (FloorFifty `room-code.ts`).
 *
 * The six-character code a player reads off a screen is the Colyseus room id, so joining by code is `joinById` and
 * no second table maps one to the other (spec §4.2 `RoomInfo.code`). Codes are claimed in a shared set (Colyseus
 * Presence in M7.3b, which has these set methods) rather than a process-local map, so two server processes behind
 * one address share one namespace and cannot hand the same code to two rooms.
 *
 * The random source is injected: the server passes a cryptographic one, tests a seeded one.
 */

// The code's alphabet and length are net's (the client reads and types the code).
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@automata/net'

/** The shared set holding every live room code. */
export const ROOM_CODE_CHANNEL = 'automata:rooms'

/** Bounded so a failing random source cannot spin forever. */
export const CODE_ATTEMPTS = 8

/** An integer in `[0, max)`. */
export type RandomInt = (max: number) => number

/** The set operations a code claim needs: Colyseus Presence's `sismember`, `sadd` and `srem`. */
export interface RoomCodeStore {
  /** Adds `member`; resolves to 1 when it was added and 0 when the set already held it (Redis and Presence `sadd`). */
  sadd(key: string, member: string): Promise<number>
  srem(key: string, member: string): Promise<unknown>
}

export function generateRoomCode(randomInt: RandomInt): string {
  let code = ''
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1)
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]
  return code
}

/**
 * Claims a free code. The shared set's add is the claim: two processes can generate the same code in the same
 * instant, and only the one whose add reports 1 holds it (a check followed by an add would let both take it).
 */
export async function claimRoomCode(store: RoomCodeStore, randomInt: RandomInt): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode(randomInt)
    if ((await store.sadd(ROOM_CODE_CHANNEL, code)) === 1) return code
  }
  throw new Error('could not allocate a room code')
}

export async function releaseRoomCode(store: RoomCodeStore, code: string): Promise<void> {
  await store.srem(ROOM_CODE_CHANNEL, code)
}
