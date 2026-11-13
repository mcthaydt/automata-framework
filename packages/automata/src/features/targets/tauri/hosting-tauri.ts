import { type HostResult, refuse } from '../../../shared/host/errors'
import type { HostingOptions } from '../../../shared/host/hosting'
import { HOST_EXIT_CAP_MS, type Hosting, type HostingSaves } from '../../../shared/host/hosting'
import { isOpenableLink } from '../../../shared/host/link'
import type { SavesStatus } from '../../../shared/host/saves.schema'
import { type Clock, systemClock, type TimeoutHandle } from '../../../shared/lib/clock'
import { disposables } from '../../../shared/lib/disposables'
import { ok, refused } from '../../../shared/lib/result'
import { emitter, subscribable } from '../../../shared/lib/subscribable'
import { makeExitHandlers } from '../exit-handlers'
import { createWebHosting, type WebPage } from '../web/hosting-web'

/*
 * The `tauri` adapter: `Hosting` for a desktop build. The game runs in Tauri's webview, so the
 * web adapter observes lifecycle, input, display, audio and fullscreen from the page as it does in a browser. What
 * the desktop adds: saves in one store file in the app's data folder (never `localStorage`, never memory), written
 * to disk shortly after each change, and `savesStatus` says when that write failed and is being tried again; Quit,
 * and the window's close request, both of which run the game's exiting handlers and the save flush before the app
 * quits. The Tauri packages are reached only through `DesktopPort` (`desktop-tauri.ts`), so tests use a fake.
 */

/**
 * How long after the game's last change to saves the store is written to disk, in milliseconds. A burst of changes
 * (a settings screen, a level's end) is one write; a crash or a kill loses at most this much. Quit and the window's
 * close write at once. A write that fails (a full disk) is tried again after the same delay.
 */
export const SAVE_WRITE_DELAY_MS = 500

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
  /** Opens an address in the system browser; rejects when no browser could be started. */
  openUrl(url: string): Promise<void>
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

  // Whether the store on disk holds every change: `retry` from a write that failed until one lands. The game's
  // `set` answered ok long before (the store's `set` is in memory), so this is the only place a full disk shows.
  const owner = disposables()
  const statusChanges = emitter<SavesStatus>(owner)
  let status: SavesStatus = 'saved'
  const setStatus = (next: SavesStatus): void => {
    if (next === status) return
    status = next
    statusChanges.emit(next)
  }

  // A change is written to disk SAVE_WRITE_DELAY_MS after the last one; a flush in between takes its place.
  let pendingWrite: TimeoutHandle | undefined
  const cancelWrite = (): void => {
    if (pendingWrite !== undefined) clock.clearTimeout(pendingWrite)
    pendingWrite = undefined
  }
  const scheduleWrite = (): void => {
    cancelWrite()
    pendingWrite = clock.setTimeout(() => {
      pendingWrite = undefined
      // Its answer is in `savesStatus`, and a failure schedules the next try: nothing here is dropped.
      void saves.flush()
    }, SAVE_WRITE_DELAY_MS)
  }
  const writeSoon = <A>(result: HostResult<A>): HostResult<A> => {
    if (result.ok) scheduleWrite()
    return result
  }

  const saves: HostingSaves = {
    get: (key) => onStore('saves.get', async (s) => (await s.get(key)) ?? null),
    set: async (key, value) => writeSoon(await onStore('saves.set', (s) => s.set(key, value))),
    remove: async (key) => writeSoon(await onStore('saves.remove', async (s) => void (await s.delete(key)))),
    flush: async () => {
      cancelWrite()
      const written = await onStore('saves.flush', async (s) => {
        await s.save()
        return { persisted: 'device' as const }
      })
      if (written.ok) setStatus('saved')
      else if (written.reason.code === 'INTERNAL' && open) {
        setStatus('retry')
        scheduleWrite()
      }
      return written
    },
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
    savesStatus: subscribable(
      () => status,
      (onChange) => statusChanges.events.subscribe(onChange),
      owner,
    ),
    exit: async () => {
      if (!open) return refuse('CANCELLED', false, 'session.exit')
      await quit()
      return ok(undefined)
    },
    // The system browser, never the webview: a page opened inside the game's own window could replace the game.
    openLink: async (url) => {
      if (!open) return refuse('CANCELLED', false, 'links.open')
      if (!isOpenableLink(url)) return refuse('INVALID_PAYLOAD', false, 'links.open')
      const opened = await desktop.openUrl(url).then(
        () => true,
        () => false,
      )
      return ok({ opened })
    },
    onExiting: exits.register,
    dispose: () => {
      open = false
      cancelWrite()
      owner.dispose()
      stopListening()
      web.dispose()
    },
  } satisfies Hosting
}
