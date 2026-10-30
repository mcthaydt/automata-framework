/**
 * Every room a server process holds, so a drain can speak to each one and the room cap can count them (FloorFifty
 * `live-rooms.ts`). An instance per server rather than FloorFifty's module-level set, so two servers in one process
 * (a test) never share one.
 */

/** The slice of a room the drain needs; kept narrow so this file imports no room. */
export interface DrainableRoom {
  beginDrain(): void
}

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
