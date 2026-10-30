/**
 * The reconnection token (M7 spec §3, §4.2; FloorFifty `colyseus-network.ts` `remember`, `forget`,
 * `readStoredSession`).
 *
 * Colyseus's reconnection token is a bearer credential for one seat, so it lives in `sessionStorage`: it survives a
 * reload of this tab, which is what `resume` needs, and nothing longer. Never `localStorage` (it would outlive the
 * tab and reach every other tab) and never the URL (a URL is copied, shared and logged).
 *
 * Storage is read through a schema: a value this module did not write, or wrote in another version, is removed and
 * read as nothing. Storage that throws (private browsing, blocked site data) costs the player only a reconnect, so
 * it is swallowed rather than allowed to break the client.
 */

import { z } from 'zod'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../wire/room'

/** The `sessionStorage` key. */
export const SEAT_TOKEN_KEY = 'automata-net.seat'

/** The slice of the Web Storage API the store uses. */
export interface SeatStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
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

const storedSeatSchema: z.ZodType<StoredSeat> = z
  .object({
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

export function createSeatTokenStore(storage: SeatStorage | undefined): SeatTokenStore {
  const quietly = (action: (storage: SeatStorage) => void): void => {
    if (storage === undefined) return
    try {
      action(storage)
    } catch {
      // Blocked storage: see the module comment.
    }
  }
  const forget = (): void => quietly((s) => s.removeItem(SEAT_TOKEN_KEY))
  return {
    read() {
      let raw: string | null = null
      quietly((s) => {
        raw = s.getItem(SEAT_TOKEN_KEY)
      })
      if (raw === null) return undefined
      let value: unknown
      try {
        value = JSON.parse(raw)
      } catch {
        value = undefined
      }
      const parsed = storedSeatSchema.safeParse(value)
      if (parsed.success) return parsed.data
      forget()
      return undefined
    },
    write(seat) {
      quietly((s) => s.setItem(SEAT_TOKEN_KEY, JSON.stringify({ code: seat.code, token: seat.token })))
    },
    forget,
  }
}
