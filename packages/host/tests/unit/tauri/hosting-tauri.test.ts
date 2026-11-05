import { Context, Duration, Effect, Either, Exit, Fiber, Layer, Scope, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { HOST_EXIT_CAP, Hosting, type HostingOptions } from '../contract/hosting'
import { describeHostingContract } from '../contract-suite'
import { runScoped } from '../testing'
import { type FakeWebPage, fakeWebPage } from '../testing/fake-web-page'
import { type DesktopPort, makeTauriHosting, type StoreLike } from './hosting-tauri'

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

function tauriHosting(
  desktop: ReturnType<typeof fakeDesktop> = fakeDesktop(),
  page: FakeWebPage = fakeWebPage(),
) {
  return {
    desktop,
    page,
    layer: Layer.scoped(Hosting, makeTauriHosting(OPTIONS, page.page, desktop.port, 'Cinder')),
  }
}

const onDesktop = <A>(
  program: (hosting: Hosting) => Effect.Effect<A, unknown, Scope.Scope>,
  built: ReturnType<typeof tauriHosting> = tauriHosting(),
) => runScoped(Effect.flatMap(Hosting, program).pipe(Effect.provide(built.layer)))

/** Lets the desktop port's promises settle (one macrotask). */
const settled: Effect.Effect<void> = Effect.promise(
  () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
)

// DIST-c: the cases every adapter passes.
describeHostingContract('the tauri adapter over a page and a desktop', () => tauriHosting().layer, settled)

describe('the tauri adapter: intended differences (DIST spec §4.3)', () => {
  it("is kind 'tauri', named after the game's title, and grants exit and saves", () =>
    onDesktop((hosting) =>
      Effect.sync(() => {
        expect(hosting.kind).toBe('tauri')
        expect(hosting.hostName).toBe('Cinder')
        expect([...hosting.granted].sort()).toEqual([
          'audio',
          'display',
          'exit',
          'input',
          'lifecycle',
          'saves',
        ])
      }),
    ))

  it("keeps saves in the app's store, never in the page's localStorage", async () => {
    const built = tauriHosting()
    await onDesktop(
      (hosting) =>
        Effect.gen(function* () {
          yield* hosting.saves.set('progress', 'level-2')
          expect(yield* hosting.saves.get('progress')).toBe('level-2')
        }),
      built,
    )
    expect([...built.desktop.entries]).toEqual([['progress', 'level-2']])
    expect(built.page.writes.filter((key) => !key.startsWith('automata:'))).toEqual([])
  })

  it('flush saves the store to disk and answers device', async () => {
    const built = tauriHosting()
    await onDesktop(
      (hosting) =>
        Effect.gen(function* () {
          yield* hosting.saves.set('progress', '2')
          expect(yield* hosting.saves.flush).toEqual({ persisted: 'device' })
        }),
      built,
    )
    expect(built.desktop.calls).toEqual(['set progress', 'save'])
  })

  it('a store that will not load: saves are not granted, every call fails DENIED, and nothing is written (DIST-d)', async () => {
    const built = tauriHosting(fakeDesktop({ store: 'unloadable' }))
    await onDesktop(
      (hosting) =>
        Effect.gen(function* () {
          expect(hosting.granted.has('saves')).toBe(false)
          for (const call of [
            hosting.saves.set('progress', '2'),
            hosting.saves.get('progress'),
            hosting.saves.remove('progress'),
            hosting.saves.flush,
            hosting.saves.keys,
          ] as Effect.Effect<unknown, { code: string }>[]) {
            expect((yield* Effect.flip(call)).code).toBe('DENIED')
          }
        }),
      built,
    )
    expect(built.desktop.calls).toEqual([])
    expect(built.page.writes.filter((key) => !key.startsWith('automata:'))).toEqual([])
  })

  it('a write the disk refuses fails INTERNAL and may be retried', () =>
    onDesktop(
      (hosting) =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(hosting.saves.set('progress', '2'))
          expect(error).toMatchObject({ code: 'INTERNAL', retryable: true, operation: 'saves.set' })
        }),
      tauriHosting(fakeDesktop({ failWrites: true })),
    ))

  it('exit runs the exiting handlers in order, then the flush, then quits', async () => {
    const built = tauriHosting()
    await onDesktop(
      (hosting) =>
        Effect.gen(function* () {
          yield* hosting.onExiting(
            Effect.promise(() => built.desktop.port.loadStore().then((s) => s.set('last', 'a'))),
          )
          yield* hosting.onExiting(Effect.sync(() => built.desktop.calls.push('second handler')))
          yield* hosting.exit('completed')
        }),
      built,
    )
    expect(built.desktop.calls).toEqual(['set last', 'second handler', 'save', 'exit'])
  })

  it('holds the window close until the handlers and the flush ran, then quits', async () => {
    const built = tauriHosting()
    await onDesktop(
      (hosting) =>
        Effect.gen(function* () {
          yield* hosting.onExiting(Effect.sync(() => built.desktop.calls.push('handler')))
          yield* settled
          expect(built.desktop.requestClose()).toBe(true)
          yield* settled
          expect(built.desktop.calls).toEqual(['handler', 'save', 'exit'])
        }),
      built,
    )
  })

  it('cuts a handler that never finishes at HOST_EXIT_CAP, and still quits', () =>
    runScoped(
      Effect.gen(function* () {
        const built = tauriHosting()
        const scope = yield* Scope.make()
        const hosting = Context.get(yield* Layer.buildWithScope(built.layer, scope), Hosting)
        yield* hosting.onExiting(Effect.never).pipe(Scope.extend(scope))
        const exiting = yield* Effect.fork(hosting.exit())
        yield* TestClock.adjust(Duration.sum(HOST_EXIT_CAP, Duration.millis(1)))
        yield* Fiber.join(exiting)
        yield* settled
        expect(built.desktop.calls).toContain('exit')
        yield* Scope.close(scope, Exit.void)
      }).pipe(Effect.provide(TestContext.TestContext)),
    ))

  it('fails exit with CANCELLED once Hosting has shut down', () =>
    runScoped(
      Effect.gen(function* () {
        const scope = yield* Scope.make()
        const hosting = Context.get(yield* Layer.buildWithScope(tauriHosting().layer, scope), Hosting)
        yield* Scope.close(scope, Exit.void)
        const result = yield* Effect.either(hosting.exit())
        expect(Either.isLeft(result) && result.left).toMatchObject({ code: 'CANCELLED' })
      }),
    ))
})
