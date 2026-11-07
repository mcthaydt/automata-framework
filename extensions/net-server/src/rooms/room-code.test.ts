import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@automata/net'
import { createRng } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import {
  CODE_ATTEMPTS,
  claimRoomCode,
  generateRoomCode,
  ROOM_CODE_CHANNEL,
  type RoomCodeStore,
  releaseRoomCode,
} from './room-code'

// FloorFifty `tests/server/rooms/room-code.test.ts` (4 cases). The random source is injected (a seeded one here);
// FloorFifty's `LocalPresence` becomes an in-memory store with Presence's set methods.

/** A seeded `randomInt(max)`: an integer in [0, max). */
function seededRandom(seed: number): (max: number) => number {
  const rng = createRng(seed)
  return (max) => rng.int(max)
}

/** Presence's set methods over one in-memory map of sets. */
function memoryStore(): RoomCodeStore & { members(key: string): string[] } {
  const sets = new Map<string, Set<string>>()
  const setOf = (key: string): Set<string> => {
    let set = sets.get(key)
    if (set === undefined) {
      set = new Set()
      sets.set(key, set)
    }
    return set
  }
  return {
    sadd: async (key, member) => {
      const set = setOf(key)
      if (set.has(member)) return 0
      set.add(member)
      return 1
    },
    srem: async (key, member) => {
      setOf(key).delete(member)
    },
    members: (key) => [...setOf(key)],
  }
}

describe('room codes', () => {
  it('uses only unambiguous characters', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IO01]/)
    expect(ROOM_CODE_LENGTH).toBe(6)
    const random = seededRandom(1)
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const code = generateRoomCode(random)
      expect(code).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`))
    }
  })

  it('does not repeat a code that is still claimed', async () => {
    const store = memoryStore()
    const random = seededRandom(2)
    const claimed = new Set<string>()
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = await claimRoomCode(store, random)
      expect(claimed.has(code)).toBe(false)
      claimed.add(code)
    }
    expect(store.members(ROOM_CODE_CHANNEL)).toHaveLength(50)
  })

  it('returns a released code to the namespace', async () => {
    const store = memoryStore()
    const code = await claimRoomCode(store, seededRandom(3))
    await releaseRoomCode(store, code)
    expect(store.members(ROOM_CODE_CHANNEL)).not.toContain(code)
  })

  // Review of M7.3a: the shared set's add decides the claim. A separate membership check then add lets two
  // processes both see a code as free and both take it.
  it('claims a code only when the shared set says it added it', async () => {
    const takenElsewhere = new Set<string>()
    const store: RoomCodeStore = {
      ...memoryStore(),
      // Another process took the first code between any check and this add.
      sadd: async (_key, member) => {
        if (takenElsewhere.size === 0) {
          takenElsewhere.add(member)
          return 0
        }
        return 1
      },
    }
    const code = await claimRoomCode(store, seededRandom(5))
    expect(takenElsewhere.has(code)).toBe(false)
  })

  it('gives up rather than spinning when the source keeps colliding', async () => {
    let asked = 0
    const everyCode: RoomCodeStore = {
      ...memoryStore(),
      sadd: async () => {
        asked += 1
        return 0
      },
    }
    await expect(claimRoomCode(everyCode, seededRandom(4))).rejects.toThrow(/allocate/i)
    expect(asked).toBe(CODE_ATTEMPTS)
  })
})
