// What `net`'s UI reads: core gives an extension's components no services context, so the game hands `installNetUi` the
// connection, the grace, a way to leave and the words, and the badge and overlay read them from here (as `debug` does).
import type { ConnectionState } from '@automata/net'
import { NET_COPY_EN } from './net-copy'

export interface NetUiHost {
  /** The connection now, and a way to hear it change (a `NetRoom.connection` subscription). */
  readonly connection: {
    get(): ConnectionState
    subscribe(listener: (state: ConnectionState) => void): () => void
  }
  /** net.toml's `reconnectGraceSeconds`. */
  readonly graceSeconds: number
  /** `NetRoom.leave`, fire and forget: the overlay's Leave and Back. */
  leave(): void
  /** Milliseconds; `performance.now` by default. */
  readonly now?: (() => number) | undefined
  /** The catalog (keys from `net-copy`); English by default. */
  readonly copy?: Readonly<Record<string, string>> | undefined
}

let current: NetUiHost | undefined

/** Makes `host` the one the badge and overlay read. Returns a dispose that removes it (if it is still the current one). */
export function installNetUi(host: NetUiHost): () => void {
  current = host
  return () => {
    if (current === host) current = undefined
  }
}
export const currentNetUi = (): NetUiHost | undefined => current
export const copyOf = (host: NetUiHost): Readonly<Record<string, string>> => host.copy ?? NET_COPY_EN
