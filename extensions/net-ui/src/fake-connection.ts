// A connection a test can drive: the shape `NetUiHost.connection` asks for.
import type { ConnectionState } from '@automata/net'
import type { NetUiHost } from './host'

export interface FakeConnection {
  readonly host: NetUiHost & { readonly leaves: number }
  set(state: ConnectionState): void
  /** Moves the host's clock. */
  advance(ms: number): void
}

export function fakeConnection(initial: ConnectionState = 'offline', graceSeconds = 30): FakeConnection {
  let state = initial
  let time = 0
  let leaves = 0
  const listeners = new Set<(state: ConnectionState) => void>()
  const host = {
    connection: {
      get: () => state,
      subscribe(listener: (state: ConnectionState) => void) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    graceSeconds,
    leave() {
      leaves += 1
    },
    now: () => time,
    get leaves() {
      return leaves
    },
  }
  return {
    host,
    set(next) {
      state = next
      for (const listener of [...listeners]) listener(next)
    },
    advance(ms) {
      time += ms
    },
  }
}
