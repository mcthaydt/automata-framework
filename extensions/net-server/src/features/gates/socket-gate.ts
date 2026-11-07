/**
 * Open WebSockets, per address and overall.
 *
 * Sixteen per address (the default) covers four players behind one router with their reconnects; the total is a
 * socket per seat in every room the server may hold, plus headroom for joins in flight. An address with no open
 * socket is forgotten. Refusing a socket never touches the ones already open.
 */

export interface SocketGate {
  /** Counts one more socket from `ip`, or refuses it. */
  admit(ip: string): boolean
  /** Counts one socket from `ip` closed. */
  release(ip: string): void
  readonly open: number
  readonly addresses: number
}

/** Sockets beyond one per seat that the server holds for joins in flight. */
export const SOCKET_HEADROOM: number = 64

/** The most sockets the server holds at once: one per seat of `maxRooms` rooms, plus the headroom. */
export function socketTotal(maxRooms: number, seatsPerRoom: number): number {
  return maxRooms * seatsPerRoom + SOCKET_HEADROOM
}

export function createSocketGate(limits: {
  readonly maxPerIp: number
  readonly maxTotal: number
}): SocketGate {
  const perIp = new Map<string, number>()
  let open = 0
  return {
    admit(ip) {
      const mine = perIp.get(ip) ?? 0
      if (mine >= limits.maxPerIp || open >= limits.maxTotal) return false
      perIp.set(ip, mine + 1)
      open += 1
      return true
    },
    release(ip) {
      const mine = perIp.get(ip)
      if (mine === undefined) return
      if (mine <= 1) perIp.delete(ip)
      else perIp.set(ip, mine - 1)
      open -= 1
    },
    get open() {
      return open
    },
    get addresses() {
      return perIp.size
    },
  }
}
