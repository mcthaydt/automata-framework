import { describe, expect, it } from 'vitest'
import {
  createTauriHosting,
  type DesktopPort,
  type StoreLike,
} from '#src/features/targets/tauri/hosting-tauri.ts'
import type { HostResult } from '#src/shared/host/errors.ts'
import type { HostingOptions } from '#src/shared/host/hosting.ts'
import { HOST_EXIT_CAP_MS, type Hosting } from '#src/shared/host/hosting.ts'
import { fakeClock } from '#src/testing/fake-clock.ts'
import { describeHostingContract } from '#src/testing/host/contract-suite.ts'
import { type FakeWebPage, fakeWebPage } from '#src/testing/host/page/fake-web-page.ts'
import { unwrap } from '#src/testing/unwrap.ts'

// The `tauri` adapter (DIST spec §4.3, §6.1): the web adapter's page, plus saves in the app's store, Quit, and the
// window's close request. Tests run it over a fake page and a fake desktop port.

const OPTIONS: HostingOptions = { gameId: 'cinder', wants: ['saves'], pauseBehavior: 'pause' }

/** An in-memory desktop: a store that can fail to load or to write, and a record of every call. */
function fakeDesktop(options: { readonly store?: 'ok' | 'unloadable'; readonly failWrites?: boolean } = {}) {
  const entries = new Map<string, string>()
  const calls: string[] = []
  let closeHandler: ((event: { preventDefault(): void }) => void) | undefined
  const store: StoreLike = {
    get: async (key) => entries.get(key),
    set: async (key, value) => {
      if (options.failWrites === true) throw new Error('disk full')
      calls.push(`set ${key}`)
      entries.set(key, value)
    },
    delete: async (key) => {
      calls.push(`delete ${key}`)
      return entries.delete(key)
    },
    keys: async () => [...entries.keys()],
    save: async () => {
      calls.push('save')
    },
  }
  const port: DesktopPort = {
    loadStore: async () => {
      if (options.store === 'unloadable') throw new Error('store unreadable')
      return store
    },
    onCloseRequested: async (handler) => {
      closeHandler = handler
      return () => {
        closeHandler = undefined
      }
    },
    exitApp: async () => {
      calls.push('exit')
    },
  }
  return {
    port,
    entries,
    calls,
    /** The player closes the window: true when the adapter held the close (it quits by itself afterwards). */
    requestClose: () => {
      let prevented = false
      closeHandler?.({ preventDefault: () => (prevented = true) })
      return prevented
    },
  }
}

/** The desktop adapter over a fake page and a fake desktop port. */
function tauriHosting(
  desktop: ReturnType<typeof fakeDesktop> = fakeDesktop(),
  page: FakeWebPage = fakeWebPage(),
  clock = fakeClock(),
) {
  return {
    desktop,
    page,
    clock,
    create: () => createTauriHosting(OPTIONS, page.page, desktop.port, 'Cinder', clock),
  }
}

/** Runs `program` on the desktop adapter and disposes it afterwards. */
async function onDesktop<A>(
  program: (hosting: Hosting) => Promise<A> | A,
  built: ReturnType<typeof tauriHosting> = tauriHosting(),
): Promise<A> {
  const hosting = await built.create()
  try {
    return await program(hosting)
  } finally {
    hosting.dispose()
  }
}

/** Lets the desktop port's promises settle (one macrotask). */
const settled = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0))

// DIST-c: the cases every adapter passes.
describeHostingContract('the tauri adapter over a page and a desktop', () => tauriHosting().create(), settled)

describe('the tauri adapter: intended differences (DIST spec §4.3)', () => {
  it("is kind 'tauri', named after the game's title, and grants exit and saves", () =>
    onDesktop((hosting) => {
      expect(hosting.kind).toBe('tauri')
      expect(hosting.hostName).toBe('Cinder')
      expect([...hosting.granted].sort()).toEqual(['audio', 'display', 'exit', 'input', 'lifecycle', 'saves'])
    }))

  it("keeps saves in the app's store, never in the page's localStorage", async () => {
    const built = tauriHosting()
    await onDesktop(async (hosting) => {
      unwrap(await hosting.saves.set('progress', 'level-2'))
      expect(unwrap(await hosting.saves.get('progress'))).toBe('level-2')
    }, built)
    expect([...built.desktop.entries]).toEqual([['progress', 'level-2']])
    expect(built.page.writes.filter((key) => !key.startsWith('automata:'))).toEqual([])
  })

  it('flush saves the store to disk and answers device', async () => {
    const built = tauriHosting()
    await onDesktop(async (hosting) => {
      unwrap(await hosting.saves.set('progress', '2'))
      expect(unwrap(await hosting.saves.flush())).toEqual({ persisted: 'device' })
    }, built)
    expect(built.desktop.calls).toEqual(['set progress', 'save'])
  })

  it('a store that will not load: saves are not granted, every call is refused DENIED, and nothing is written (DIST-d)', async () => {
    const built = tauriHosting(fakeDesktop({ store: 'unloadable' }))
    await onDesktop(async (hosting) => {
      expect(hosting.granted.has('saves')).toBe(false)
      for (const call of [
        hosting.saves.set('progress', '2'),
        hosting.saves.get('progress'),
        hosting.saves.remove('progress'),
        hosting.saves.flush(),
        hosting.saves.keys(),
      ]) {
        expect(await call).toMatchObject({ ok: false, reason: { code: 'DENIED' } })
      }
    }, built)
    expect(built.desktop.calls).toEqual([])
    expect(built.page.writes.filter((key) => !key.startsWith('automata:'))).toEqual([])
  })

  it('a write the disk refuses is refused INTERNAL and may be retried', () =>
    onDesktop(
      async (hosting) => {
        expect(await hosting.saves.set('progress', '2')).toMatchObject({
          ok: false,
          reason: { code: 'INTERNAL', retryable: true, operation: 'saves.set' },
        })
      },
      tauriHosting(fakeDesktop({ failWrites: true })),
    ))

  it('exit runs the exiting handlers in order, then the flush, then quits', async () => {
    const built = tauriHosting()
    await onDesktop(async (hosting) => {
      hosting.onExiting(async () => {
        const store = await built.desktop.port.loadStore()
        await store.set('last', 'a')
      })
      hosting.onExiting(() => void built.desktop.calls.push('second handler'))
      unwrap(await hosting.exit('completed'))
    }, built)
    expect(built.desktop.calls).toEqual(['set last', 'second handler', 'save', 'exit'])
  })

  it('holds the window close until the handlers and the flush ran, then quits', async () => {
    const built = tauriHosting()
    await onDesktop(async (hosting) => {
      hosting.onExiting(() => void built.desktop.calls.push('handler'))
      await settled()
      expect(built.desktop.requestClose()).toBe(true)
      await settled()
      expect(built.desktop.calls).toEqual(['handler', 'save', 'exit'])
    }, built)
  })

  it('cuts a handler that never finishes at HOST_EXIT_CAP_MS, and still quits', async () => {
    const built = tauriHosting()
    await onDesktop(async (hosting) => {
      hosting.onExiting(() => new Promise<void>(() => undefined))
      const exiting = hosting.exit()
      await settled()
      expect(built.desktop.calls).not.toContain('exit')
      built.clock.advance(HOST_EXIT_CAP_MS)
      unwrap(await exiting)
      expect(built.desktop.calls).toContain('exit')
    }, built)
  })

  it('refuses exit with CANCELLED once Hosting has been disposed', async () => {
    const hosting = await tauriHosting().create()
    hosting.dispose()
    expect(await hosting.exit()).toMatchObject({ ok: false, reason: { code: 'CANCELLED' } })
  })

  it('stops listening for the window close once disposed', async () => {
    const built = tauriHosting()
    const hosting = await built.create()
    hosting.dispose()
    expect(built.desktop.requestClose()).toBe(false)
  })
})
