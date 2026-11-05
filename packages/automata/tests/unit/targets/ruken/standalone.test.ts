import type { SdkEnv, StorageLike } from '@ruken/sdk'
import { describe, expect, it } from 'vitest'
import type { HostResult } from '#src/shared/host/errors.ts'
import { withHostingTest } from '#src/testing/host/page/index.ts'
import { unwrap } from '#src/testing/unwrap.ts'

/** A top-level page: the SDK returns its standalone session at once (shared contracts §1.1). */
const topLevel =
  (storage?: StorageLike | null) =>
  (env: SdkEnv): SdkEnv => ({
    ...env,
    isTopLevel: true,
    ...(storage === undefined ? {} : { storage }),
  })

describe("a top-level page: the SDK's standalone session (FloorFifty hosting, standalone cases)", () => {
  it('is ready at once, full volume, nothing reserved, and sends the host nothing', () =>
    withHostingTest(
      async ({ hosting, handle: { host } }) => {
        unwrap(await hosting.ready)
        expect(hosting.audio.get().gain).toBe(1)
        expect(hosting.display.get().hostReserved.rect.w).toBe(0)
        expect(hosting.lifecycle.get().state).toBe('active')
        expect(host.messages.filter((entry) => entry.dir === 'in')).toEqual([])
      },
      { env: topLevel() },
    ))

  it("keeps saves in the page's own storage under Ruken's ruken:<gameId>: prefix", async () => {
    const storage = new Map<string, string>()
    const local: StorageLike = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => void storage.set(key, value),
      removeItem: (key) => void storage.delete(key),
      key: (index) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size
      },
    }
    await withHostingTest(
      async ({ hosting }) => {
        unwrap(await hosting.saves.set('progress', '2'))
        expect(unwrap(await hosting.saves.get('progress'))).toBe('2')
        expect([...storage.keys()].every((key) => key.startsWith('ruken:blank-game:'))).toBe(true)
        expect(storage.size).toBeGreaterThan(0)
      },
      { env: topLevel(local) },
    )
  })

  it("relays the standalone session's refusals: exit does nothing, fullscreen is unsupported", () =>
    withHostingTest(
      async ({ hosting }) => {
        await hosting.exit()
        expect(unwrap(await hosting.setFullscreen(true))).toEqual({ fullscreen: false, support: 'none' })
        hosting.track('anything')
        hosting.round.start()
        hosting.round.end('complete')
      },
      { env: topLevel() },
    ))

  it("pins the SDK's behaviour with no page storage (private mode): saves last the visit only", () =>
    // Ruken's standalone store keeps values in memory when localStorage is unavailable
    // (sdk/src/saves-local.ts). AF relays that and adds nothing.
    withHostingTest(
      async ({ hosting }) => {
        unwrap(await hosting.saves.set('progress', '2'))
        expect(unwrap(await hosting.saves.get('progress'))).toBe('2')
      },
      { env: topLevel(null) },
    ))
})
