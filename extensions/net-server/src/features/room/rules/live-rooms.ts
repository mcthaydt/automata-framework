/**
 * Every room a server process holds, so a drain can speak to each one and the room cap can count them. An instance per server rather than a module-level set, so two servers in one process
 * (a test) never share one.
 */

/** The slice of a room the drain needs; kept narrow so this file imports no room. */
export interface DrainableRoom {
  beginDrain(): void
}

/**
 * Every room a server process holds. The room cap counts them and a drain speaks to each. One per
 * server, so two servers in a test never share a set.
 */
export class LiveRooms<R extends DrainableRoom = DrainableRoom> implements Iterable<R> {
  private readonly rooms = new Set<R>()

  get size(): number {
    return this.rooms.size
  }

  register(room: R): void {
    this.rooms.add(room)
  }

  forget(room: R): void {
    this.rooms.delete(room)
  }

  [Symbol.iterator](): Iterator<R> {
    return this.rooms.values()
  }
}
