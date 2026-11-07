/**
 * Room codes are claimed in Colyseus Presence's shared set (M7.3a `room-code.ts`): the add is the claim, and only
 * the add that reports 1 holds the code. A shared presence (Redis) answers its add with that count. The
 * single-process `LocalPresence` answers nothing, so its count is read on either side of the add: it is synchronous,
 * and nothing can run between the two reads.
 */

import { LocalPresence, type Presence } from '@colyseus/core'
import type { RoomCodeStore } from '../rooms/room-code'

export function presenceCodeStore(presence: Presence): RoomCodeStore {
  return {
    async sadd(key, member) {
      if (presence instanceof LocalPresence) {
        const before = presence.scard(key)
        presence.sadd(key, member)
        return presence.scard(key) - before
      }
      return Number(await presence.sadd(key, member))
    },
    async srem(key, member) {
      return presence.srem(key, member)
    },
  }
}
