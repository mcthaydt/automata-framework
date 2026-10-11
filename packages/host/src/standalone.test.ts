import type { SdkEnv, StorageLike } from '@ruken/sdk'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { Hosting } from './hosting.service'
import { FakeHostHandle, HostingTest, runScoped } from './testing'

/** A top-level page: the SDK returns its standalone session at once (shared contracts §1.1). */
const topLevel =
  (storage?: StorageLike | null) =>
  (env: SdkEnv): SdkEnv => ({
    ...env,
    isTopLevel: true,
    ...(storage === undefined ? {} : { storage }),
  })

describe("a top-level page: the SDK's standalone session (FloorFifty hosting, standalone cases)", () => {
  it('is ready at once, full volume, nothing reserved, and sends the host nothing', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        yield* hosting.ready
        expect((yield* hosting.audio.get).gain).toBe(1)
        expect((yield* hosting.display.get).hostReserved.rect.w).toBe(0)
        expect((yield* hosting.lifecycle.get).state).toBe('active')
        expect(host.messages.filter((entry) => entry.dir === 'in')).toEqual([])
      }).pipe(Effect.provide(HostingTest({ env: topLevel() }))),
    )
  })

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
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        yield* hosting.saves.set('progress', '2')
        expect(yield* hosting.saves.get('progress')).toBe('2')
        expect([...storage.keys()].every((key) => key.startsWith('ruken:blank-game:'))).toBe(true)
        expect(storage.size).toBeGreaterThan(0)
      }).pipe(Effect.provide(HostingTest({ env: topLevel(local) }))),
    )
  })

  it("relays the standalone session's refusals: exit does nothing, fullscreen is unsupported", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        yield* hosting.exit()
        expect(yield* hosting.setFullscreen(true)).toEqual({ fullscreen: false, support: 'none' })
        yield* hosting.track('anything')
        yield* hosting.round.start
        yield* hosting.round.end('complete')
      }).pipe(Effect.provide(HostingTest({ env: topLevel() }))),
    )
  })

  it("pins the SDK's behaviour with no page storage (private mode): saves last the visit only", async () => {
    // Ruken's standalone store keeps values in memory when localStorage is unavailable
    // (sdk/src/saves-local.ts). AF relays that and adds nothing.
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        yield* hosting.saves.set('progress', '2')
        expect(yield* hosting.saves.get('progress')).toBe('2')
      }).pipe(Effect.provide(HostingTest({ env: topLevel(null) }))),
    )
  })
})
