import { z } from 'zod'
import type { DeviceStorage } from '../../shared/runtime/settings/device-storage.js'

// What this device has already shown its player: one record in device storage, once per device (not per player, since
// the first-run screens are about the device's language and the game's lights). The language the player picks is not
// here: `Locale.set` saves it, as Settings does.

/** The device-storage key of the record. The storage already prefixes it with the game's id. */
export const SEEN_KEY = 'automata.seen'

/** The first-run screens a device can have seen. */
export type SeenFlag = 'language' | 'photosensitivity'

/** Which first-run screens this device has shown. */
export interface SeenFlags {
  has(flag: SeenFlag): boolean
  /** Records that the screen was shown. A storage that cannot be written still keeps it for this visit. */
  mark(flag: SeenFlag): void
}

/** Every field is read on its own, so one that is garbage reads as "not seen" and the others stand. */
const recordSchema = z.object({
  language: z.boolean().catch(false),
  photosensitivity: z.boolean().catch(false),
})

type Record = z.infer<typeof recordSchema>

const NOTHING_SEEN: Record = { language: false, photosensitivity: false }

function read(storage: DeviceStorage | undefined): Record {
  if (storage === undefined) return { ...NOTHING_SEEN }
  try {
    const raw = storage.get(SEEN_KEY)
    if (raw === null) return { ...NOTHING_SEEN }
    const parsed = recordSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : { ...NOTHING_SEEN }
  } catch {
    // Unreadable storage or text that is not JSON: nothing seen.
    return { ...NOTHING_SEEN }
  }
}

/**
 * The seen flags over a device's storage. Storage that is absent, blocked (private mode) or full never throws here:
 * the flags then live for the visit only, so the first-run screens still show and go on, once per visit.
 */
export function createSeenFlags(storage: DeviceStorage | undefined): SeenFlags {
  // What this visit has marked, kept whether or not the storage took it.
  const visit: Record = read(storage)
  return {
    has: (flag) => visit[flag] || read(storage)[flag],
    mark(flag) {
      visit[flag] = true
      try {
        storage?.set(SEEN_KEY, JSON.stringify({ ...read(storage), ...visit }))
      } catch {
        // Kept for this visit in `visit`.
      }
    },
  }
}
