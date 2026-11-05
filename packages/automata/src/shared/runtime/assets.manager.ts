import type { AssetsSource } from '@mcthaydt/automata-content'
import { ok, type Result, refused } from '../lib/result.ts'
import { AssetLoadFailed, LoadStalled } from './boot-error.js'
import { readBlob } from './fetch-progress.js'
import type { LoadMeter } from './load-meter.js'

/**
 * The asset loader: `load` fetches a screen's assets and fonts with progress and answers `{ ok: false, reason }`
 * with `AssetLoadFailed` or `LoadStalled` when one of them cannot be had; `get` returns a loaded file by path.
 * A load whose `signal` aborts rejects with the abort reason and stops the downloads nobody else waits for.
 */
export interface Assets {
  load(
    screen: string,
    onProgress?: (fraction: number | undefined) => void,
    signal?: AbortSignal,
  ): Promise<Result<void, AssetLoadFailed | LoadStalled>>
  get(path: string): Blob | undefined
  isLoaded(screen: string): boolean
}

export interface CreateAssetsOptions {
  readonly assets: AssetsSource | undefined
  readonly fonts: Readonly<Record<string, readonly string[]>>
  readonly fetch?: typeof fetch
  readonly fontFaces?: Pick<FontFaceSet, 'load'>
  readonly meter: LoadMeter
}

interface FileProgressState {
  received: number
  total: number | undefined
  done: boolean
}

interface InFlightFile {
  readonly download: Promise<Blob>
  readonly controller: AbortController
  waiters: number
}

/** Rejects with the signal's reason once it aborts; never settles otherwise. */
function abortedBy(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

/**
 * Creates the asset loader.
 * Manages single-flight asset downloads (two screens sharing a file fetch it once; the fetch stops only when every
 * waiter has gone), byte progress reporting, and font readiness under the load meter stall rule.
 *
 * Note: AF does not use Pixi's loader, so there is no promise cache of Pixi's to work around; aborting the fetch's
 * signal cleanly stops the underlying download.
 */
export function createAssets(options: CreateAssetsOptions): Assets {
  const fetchFn = options.fetch ?? globalThis.fetch
  const blobs = new Map<string, Blob>()
  const inFlightFiles = new Map<string, InFlightFile>()
  const fileProgress = new Map<string, FileProgressState>()
  const loadedScreens = new Set<string>()
  const screenListeners = new Map<string, Set<(fraction: number | undefined) => void>>()

  const calculateFraction = (files: readonly string[]): number | undefined => {
    if (files.length === 0) return 1
    let anyReceived = false
    let sum = 0

    for (const file of files) {
      const state = fileProgress.get(file)
      if (state) {
        if (state.received > 0 || state.done) {
          anyReceived = true
        }
        if (state.done) {
          sum += 1
        } else if (state.total !== undefined && state.total > 0) {
          sum += state.received / state.total
        }
      }
    }

    if (!anyReceived) return undefined
    return sum / files.length
  }

  const notifyScreen = (screen: string) => {
    const listeners = screenListeners.get(screen)
    if (!listeners || listeners.size === 0) return
    const files = options.assets?.screens[screen]?.files ?? []
    const fraction = calculateFraction(files)
    for (const listener of [...listeners]) {
      listener(fraction)
    }
  }

  const notifyScreensForFile = (url: string) => {
    if (!options.assets?.screens) return
    for (const [screen, screenDef] of Object.entries(options.assets.screens)) {
      if (screenDef.files.includes(url)) {
        notifyScreen(screen)
      }
    }
  }

  /** Downloads `url` under the stall rule, reporting byte progress to the meter and the screens that list it. */
  const download = async (url: string, signal: AbortSignal): Promise<Blob> => {
    let response: Response
    try {
      response = await fetchFn(url, { signal })
    } catch (err) {
      if (signal.aborted) throw err
      throw new AssetLoadFailed({ url, status: 0 })
    }
    if (!response.ok) throw new AssetLoadFailed({ url, status: response.status })

    fileProgress.set(url, { received: 0, total: undefined, done: false })
    let blob: Blob
    try {
      blob = await readBlob(response, 'application/octet-stream', (p) => {
        fileProgress.set(url, { received: p.received, total: p.total, done: false })
        options.meter.progress()
        notifyScreensForFile(url)
      })
    } catch (err) {
      if (signal.aborted) throw err
      throw new AssetLoadFailed({ url, status: 0 })
    }
    fileProgress.set(url, { received: blob.size, total: blob.size, done: true })
    blobs.set(url, blob)
    notifyScreensForFile(url)
    return blob
  }

  /** One file, shared by every load that waits for it. A waiter whose signal aborts leaves; the last one out stops it. */
  const loadFile = (url: string, signal: AbortSignal): Promise<Blob> => {
    const cachedBlob = blobs.get(url)
    if (cachedBlob) return Promise.resolve(cachedBlob)

    let entry = inFlightFiles.get(url)
    if (!entry) {
      const controller = new AbortController()
      const started: InFlightFile = {
        controller,
        waiters: 0,
        download: options.meter
          .guard(
            (guardSignal) => download(url, guardSignal),
            {
              url,
              bytesSoFar: () => fileProgress.get(url)?.received ?? 0,
            },
            controller.signal,
          )
          .then(
            (blob) => {
              if (inFlightFiles.get(url) === started) inFlightFiles.delete(url)
              return blob
            },
            (err: unknown) => {
              if (inFlightFiles.get(url) === started) {
                inFlightFiles.delete(url)
                fileProgress.delete(url)
              }
              throw err
            },
          ),
      }
      // Every waiter may leave before it settles; its rejection is still handled, by nobody.
      started.download.catch(() => undefined)
      inFlightFiles.set(url, started)
      entry = started
    }

    const current = entry
    current.waiters++
    const leave = () => {
      current.waiters--
      if (current.waiters === 0 && inFlightFiles.get(url) === current) {
        inFlightFiles.delete(url)
        fileProgress.delete(url)
        current.controller.abort(signal.reason)
      }
    }
    signal.addEventListener('abort', leave, { once: true })
    return Promise.race([current.download, abortedBy(signal)]).finally(() =>
      signal.removeEventListener('abort', leave),
    )
  }

  const isLoaded = (screen: string): boolean => loadedScreens.has(screen)

  const get = (path: string): Blob | undefined => blobs.get(path)

  const load = async (
    screen: string,
    onProgress?: (fraction: number | undefined) => void,
    signal?: AbortSignal,
  ): Promise<Result<void, AssetLoadFailed | LoadStalled>> => {
    if (loadedScreens.has(screen)) {
      onProgress?.(1)
      return ok(undefined)
    }

    const files = options.assets?.screens[screen]?.files ?? []
    const fontList = options.fonts[screen] ?? []

    let listeners = screenListeners.get(screen)
    if (!listeners) {
      listeners = new Set()
      screenListeners.set(screen, listeners)
    }
    if (onProgress) {
      listeners.add(onProgress)
      onProgress(calculateFraction(files))
    }

    // The first file or font that fails stops the rest of this screen's load, as the caller's abort does.
    const screenLoad = new AbortController()
    const stopOnCallerAbort = () => screenLoad.abort(signal?.reason)
    if (signal?.aborted) stopOnCallerAbort()
    else signal?.addEventListener('abort', stopOnCallerAbort, { once: true })
    const failFast = <A>(work: Promise<A>): Promise<A> =>
      work.catch((err: unknown) => {
        screenLoad.abort(err)
        throw err
      })

    try {
      await Promise.all(files.map((file) => failFast(loadFile(file, screenLoad.signal))))
      const fontFaces = options.fontFaces
      if (fontList.length > 0 && fontFaces) {
        await Promise.all(
          fontList.map((font) =>
            failFast(
              options.meter.guard(
                () =>
                  fontFaces.load(font).catch(() => {
                    throw new AssetLoadFailed({ url: font, status: 0 })
                  }),
                { url: font },
                screenLoad.signal,
              ),
            ),
          ),
        )
      }
      loadedScreens.add(screen)
      onProgress?.(1)
      return ok(undefined)
    } catch (err) {
      // The caller's own abort is not an answer about the assets: it rejects, as an interrupted wait did.
      if (signal?.aborted) throw signal.reason
      if (err instanceof AssetLoadFailed || err instanceof LoadStalled) return refused(err)
      throw err
    } finally {
      signal?.removeEventListener('abort', stopOnCallerAbort)
      if (onProgress) listeners.delete(onProgress)
    }
  }

  return { load, get, isLoaded }
}
