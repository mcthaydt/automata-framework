/**
 * The reconnection token.
 *
 * Colyseus's reconnection token is a bearer credential for one seat, so it lives in `sessionStorage`: it survives a
 * reload of this tab, which is what `resume` needs, and nothing longer. Never `localStorage` (it would outlive the
 * tab and reach every other tab) and never the URL (a URL is copied, shared and logged).
 *
 * **Memory first, storage written through.** The current seat is held in memory, so a drop reconnects whether or not
 * storage works (private browsing, blocked site data, a worker, a headless client in Node). Storage only carries the
 * seat across a reload; a write that throws costs the next page load its `resume`, nothing else.
 *
 * **Per server.** Every game on one origin (itch.io serves them all from one) shares a `sessionStorage`. The seat is
 * kept under a key named by the server's url, and the record carries the url and the game's schema and content
 * hashes: a seat stored for another server, or by another build of this game, is never presented here, and is left
 * where it is. A value under this server's key that does not parse is removed.
 */

import { z } from 'zod'
import { hex16Schema } from '../../../shared/wire/primitives.schema'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../../shared/wire/room'

/** The `sessionStorage` key's prefix; the server's url follows it (`seatTokenKey`). */
export const SEAT_TOKEN_KEY = 'automata-net.seat'

/** The key a server's seat is stored under. */
export const seatTokenKey = (url: string): string => `${SEAT_TOKEN_KEY}:${url}`

/** The slice of the Web Storage API the store uses. */
export interface SeatStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Which server and which build a seat belongs to. */
export interface SeatOwner {
  readonly url: string
  readonly schemaHash: string
  readonly contentHash: string
}

/** The seat a reconnect or a reload reclaims: the room's code and Colyseus's token for the seat. */
export interface StoredSeat {
  readonly code: string
  readonly token: string
}

export interface SeatTokenStore {
  read(): StoredSeat | undefined
  write(seat: StoredSeat): void
  forget(): void
}

/** Colyseus writes `roomId:secret`; bounded so a planted value cannot grow without limit. */
const TOKEN_MAX_LENGTH = 256
const URL_MAX_LENGTH = 2048

const storedRecordSchema = z
  .object({
    url: z.string().min(1).max(URL_MAX_LENGTH),
    schemaHash: hex16Schema,
    contentHash: hex16Schema,
    code: z.string().regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`)),
    token: z.string().min(1).max(TOKEN_MAX_LENGTH),
  })
  .strict()

/** This page's `sessionStorage`, or undefined where there is none or reading it throws. */
export function sessionSeatStorage(): SeatStorage | undefined {
  try {
    return (globalThis as { sessionStorage?: SeatStorage }).sessionStorage
  } catch {
    return undefined
  }
}

export function createSeatTokenStore(storage: SeatStorage | undefined, owner: SeatOwner): SeatTokenStore {
  const key = seatTokenKey(owner.url)
  let memory: StoredSeat | undefined
  const quietly = (action: (storage: SeatStorage) => void): void => {
    if (storage === undefined) return
    try {
      action(storage)
    } catch {
      // Blocked storage: see the module comment.
    }
  }
  const fromStorage = (): StoredSeat | undefined => {
    let raw: string | null = null
    quietly((s) => {
      raw = s.getItem(key)
    })
    if (raw === null) return undefined
    let value: unknown
    try {
      value = JSON.parse(raw)
    } catch {
      value = undefined
    }
    const parsed = storedRecordSchema.safeParse(value)
    if (!parsed.success) {
      quietly((s) => s.removeItem(key))
      return undefined
    }
    const record = parsed.data
    // Another server's or another build's seat: not ours to present, and not ours to delete.
    if (
      record.url !== owner.url ||
      record.schemaHash !== owner.schemaHash ||
      record.contentHash !== owner.contentHash
    )
      return undefined
    return { code: record.code, token: record.token }
  }
  return {
    read: () => memory ?? fromStorage(),
    write(seat) {
      memory = { code: seat.code, token: seat.token }
      const record = {
        url: owner.url,
        schemaHash: owner.schemaHash,
        contentHash: owner.contentHash,
        code: seat.code,
        token: seat.token,
      }
      quietly((s) => s.setItem(key, JSON.stringify(record)))
    },
    forget() {
      memory = undefined
      // Only a seat this store may present is removed: another build's record under the same url stays.
      if (fromStorage() !== undefined) quietly((s) => s.removeItem(key))
    },
  }
}
