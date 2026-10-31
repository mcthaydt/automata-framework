import { Effect, Runtime, type Scope } from 'effect'
import { HostError } from '../contract/errors'
import { HOST_EXIT_CAP, type Hosting, type HostingOptions, type HostingSaves } from '../contract/hosting'
import { makeExitHandlers } from '../exit-handlers'
import { makeWebHosting, type WebPage } from '../web/hosting-web'

/*
 * The `tauri` adapter (DIST spec §4.3, §6.1): `Hosting` for a desktop build. The game runs in Tauri's webview, so the
 * web adapter observes lifecycle, input, display, audio and fullscreen from the page as it does in a browser. What
 * the desktop adds: saves in one store file in the app's data folder (never `localStorage`, never memory), Quit,
 * and the window's close request, both of which run the game's exiting handlers and the save flush before the app
 * quits. The Tauri packages are reached only through `DesktopPort` (`desktop-tauri.ts`), so tests use a fake.
 */

/** The parts of `@tauri-apps/plugin-store`'s `Store` the adapter uses. Values are the game's save strings. */
export interface StoreLike {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<boolean>
  keys(): Promise<string[]>
  /** Writes the store to its file. */
  save(): Promise<void>
}

/** What the adapter needs from the desktop shell. `tauriDesktop()` is the real one. */
export interface DesktopPort {
  /** Opens the saves store; rejects when it cannot be read. */
  loadStore(): Promise<StoreLike>
  /** Calls `handler` when the player closes the window; resolves to a function that stops listening. */
  onCloseRequested(handler: (event: { preventDefault(): void }) => void): Promise<() => void>
  /** Quits the app. */
  exitApp(): Promise<void>
}

/**
 * Builds the desktop `Hosting` over `page` (the webview's window) and `desktop`. `title` is the host's name for UI,
 * the game's title. When the scope closes, later calls fail `CANCELLED` and the close-request listener is removed.
 */
export function makeTauriHosting(
  options: HostingOptions,
  page: WebPage,
  desktop: DesktopPort,
  title: string,
): Effect.Effect<Hosting, never, Scope.Scope> {
  return Effect.gen(function* () {
    const web = yield* makeWebHosting(options, page, 'web')
    let open = true
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        open = false
      }),
    )
    // A store that cannot be read leaves saves ungranted (DIST-d): no fallback to the page's storage or to memory.
    const store = yield* Effect.promise(() =>
      desktop.loadStore().then(
        (loaded): StoreLike | null => loaded,
        () => null,
      ),
    )

    const fail = (operation: string, code: 'CANCELLED' | 'DENIED') =>
      Effect.fail(new HostError({ code, retryable: false, operation }))
    /** One store call: `CANCELLED` once shut down, `DENIED` without a store, `INTERNAL` (retryable) when it rejects. */
    const onStore = <A>(operation: string, use: (store: StoreLike) => Promise<A>) =>
      Effect.suspend((): Effect.Effect<A, HostError> => {
        if (!open) return fail(operation, 'CANCELLED')
        if (store === null) return fail(operation, 'DENIED')
        return Effect.tryPromise({
          try: () => use(store),
          catch: (cause) => new HostError({ code: 'INTERNAL', retryable: true, operation, cause }),
        })
      })

    const saves: HostingSaves = {
      get: (key) => onStore('saves.get', async (s) => (await s.get(key)) ?? null),
      set: (key, value) => onStore('saves.set', (s) => s.set(key, value)),
      remove: (key) => onStore('saves.remove', async (s) => void (await s.delete(key))),
      flush: onStore('saves.flush', async (s) => {
        await s.save()
        return { persisted: 'device' as const }
      }),
      // Code-unit order, as every adapter sorts (M5 spec §4.1).
      keys: onStore('saves.keys', async (s) => [...(await s.keys())].sort()),
      // One app, one writer: nothing else changes the store while the game runs.
      changed: web.saves.changed,
    }

    // The handlers in registration order, then the flush, all within the cap; then the app quits.
    const exits = makeExitHandlers(HOST_EXIT_CAP)
    let quitting = false
    const quit = Effect.suspend(() => {
      if (quitting) return Effect.void
      quitting = true
      return exits
        .run(Effect.ignore(saves.flush))
        .pipe(Effect.zipRight(Effect.promise(() => desktop.exitApp().catch(() => undefined))))
    })

    const runtime = yield* Effect.runtime<never>()
    const stopListening = yield* Effect.promise(() =>
      desktop.onCloseRequested((event) => {
        // Hold the close: the app quits itself once the handlers and the flush are done.
        event.preventDefault()
        Runtime.runFork(runtime)(quit)
      }),
    )
    yield* Effect.addFinalizer(() => Effect.sync(stopListening))

    const granted = new Set(web.granted)
    granted.delete('saves')
    if (store !== null) granted.add('saves')
    granted.add('exit')

    return {
      ...web,
      kind: 'tauri',
      hostName: title,
      granted,
      saves,
      exit: () => (open ? quit : fail('session.exit', 'CANCELLED')),
      onExiting: (handler) => exits.register(handler),
    } satisfies Hosting
  })
}
