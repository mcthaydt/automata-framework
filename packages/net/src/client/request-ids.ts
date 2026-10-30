/**
 * Request ids for correlated requests (`ready`, `bot.add`, `bot.remove`, `leave`; M7 spec §4.3 command ledger).
 *
 * The room answers each id once and remembers the last answers per Colyseus session. A session survives a reload's
 * `resume`, so ids carry a per-load random prefix (FloorFifty `LOAD_TOKEN`): a reloaded page numbering from 1 again
 * would otherwise collide with remembered answers, and its requests would be answered without acting.
 */

/** Four random bytes as eight hex characters. `randomBytes` is injected for tests; the default is Web Crypto. */
export function newLoadToken(
  randomBytes: () => Uint8Array = () => globalThis.crypto.getRandomValues(new Uint8Array(4)),
): string {
  return [...randomBytes()].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export interface RequestIds {
  next(): string
}

/** `<load token>-r<n>`: at most 8 + 2 + 16 characters, inside the wire's 64. */
export function createRequestIds(loadToken: string): RequestIds {
  let counter = 0
  return {
    next() {
      counter += 1
      return `${loadToken}-r${counter}`
    },
  }
}
