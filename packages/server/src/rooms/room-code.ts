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
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@mcthaydt/automata-net'

/** The shared set holding every live room code. */
export const ROOM_CODE_CHANNEL = 'automata:rooms'

/** Bounded so a failing random source cannot spin forever. */
export const CODE_ATTEMPTS = 8

/** An integer in `[0, max)`. */
export type RandomInt = (max: number) => number

/** The set operations a code claim needs: Colyseus Presence's `sismember`, `sadd` and `srem`. */
export interface RoomCodeStore {
  sismember(key: string, member: string): Promise<boolean | number>
  sadd(key: string, member: string): Promise<unknown>
  srem(key: string, member: string): Promise<unknown>
}

export function generateRoomCode(randomInt: RandomInt): string {
  let code = ''
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1)
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]
  return code
}

/**
 * Claims a free code. Membership is checked rather than assumed: two processes can generate the same unclaimed
 * code in the same instant, and only the shared set decides it.
 */
export async function claimRoomCode(store: RoomCodeStore, randomInt: RandomInt): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode(randomInt)
    if (await store.sismember(ROOM_CODE_CHANNEL, code)) continue
    await store.sadd(ROOM_CODE_CHANNEL, code)
    return code
  }
  throw new Error('could not allocate a room code')
}

export async function releaseRoomCode(store: RoomCodeStore, code: string): Promise<void> {
  await store.srem(ROOM_CODE_CHANNEL, code)
}
