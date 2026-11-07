import type { HostingOptions } from '../../../shared/host/hosting'
import { type HostResult, refuse } from '../../../shared/host/plain-errors'
import { HOST_EXIT_CAP_MS, type Hosting, type HostingSaves } from '../../../shared/host/plain-hosting'
import { type Clock, systemClock } from '../../../shared/lib/clock'
import { ok, refused } from '../../../shared/lib/result'
import { makeExitHandlers } from '../exit-handlers'
import { createWebHosting, type WebPage } from '../web/hosting-web'

/*
 * The `tauri` adapter: `Hosting` for a desktop build. The game runs in Tauri's webview, so the
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
 * the game's title. `dispose()` makes later calls refused `CANCELLED` and removes the close-request listener.
 */
export async function createTauriHosting(
  options: HostingOptions,
  page: WebPage,
  desktop: DesktopPort,
  title: string,
  clock: Clock = systemClock,
): Promise<Hosting> {
  const web = createWebHosting(options, page, 'web')
  let open = true
  // A store that cannot be read leaves saves ungranted: no fallback to the page's storage or to memory.
  const store = await desktop.loadStore().then(
    (loaded): StoreLike | null => loaded,
    () => null,
  )

  /** One store call: `CANCELLED` once disposed, `DENIED` without a store, `INTERNAL` (retryable) when it rejects. */
  const onStore = async <A>(
    operation: string,
    use: (store: StoreLike) => Promise<A>,
  ): Promise<HostResult<A>> => {
    if (!open) return refuse('CANCELLED', false, operation)
    if (store === null) return refuse('DENIED', false, operation)
    try {
      return ok(await use(store))
    } catch (cause) {
      return refused({ code: 'INTERNAL', retryable: true, operation, cause })
    }
  }

  const saves: HostingSaves = {
    get: (key) => onStore('saves.get', async (s) => (await s.get(key)) ?? null),
    set: (key, value) => onStore('saves.set', (s) => s.set(key, value)),
    remove: (key) => onStore('saves.remove', async (s) => void (await s.delete(key))),
    flush: () =>
      onStore('saves.flush', async (s) => {
        await s.save()
        return { persisted: 'device' as const }
      }),
    // Code-unit order, as every adapter sorts.
    keys: () => onStore('saves.keys', async (s) => [...(await s.keys())].sort()),
    // One app, one writer: nothing else changes the store while the game runs.
    changed: web.saves.changed,
  }

  // The handlers in registration order, then the flush, all within the cap; then the app quits.
  const exits = makeExitHandlers(HOST_EXIT_CAP_MS, clock)
  let quitting: Promise<void> | undefined
  const quit = (): Promise<void> => {
    quitting ??= (async () => {
      await exits.run(async () => void (await saves.flush()))
      await desktop.exitApp().catch(() => undefined)
    })()
    return quitting
  }

  const stopListening = await desktop.onCloseRequested((event) => {
    // Hold the close: the app quits itself once the handlers and the flush are done.
    event.preventDefault()
    void quit()
  })

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
    exit: async () => {
      if (!open) return refuse('CANCELLED', false, 'session.exit')
      await quit()
      return ok(undefined)
    },
    onExiting: exits.register,
    dispose: () => {
      open = false
      stopListening()
      web.dispose()
    },
  } satisfies Hosting
}
