import type { AssetsSource } from '@mcthaydt/automata-content'
import { Context, Deferred, Effect, Fiber } from 'effect'
import { AssetLoadFailed, type LoadStalled } from '../../app/boot/boot-error.js'
import { readBlob } from './fetch-progress.js'
import type { LoadMeter } from './load-meter.js'

/**
 * The asset loader service: `load` fetches a screen's assets and fonts with progress, failing
 * `AssetLoadFailed` or `LoadStalled`; `get` returns a loaded file by path.
 */
export interface Assets {
  load(
    screen: string,
    onProgress?: (fraction: number | undefined) => void,
  ): Effect.Effect<void, AssetLoadFailed | LoadStalled>
  get(path: string): Blob | undefined
  isLoaded(screen: string): boolean
}

export const Assets: Context.Tag<Assets, Assets> = Context.GenericTag<Assets>(
  '@mcthaydt/automata-runtime/Assets',
)

export interface MakeAssetsOptions {
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
  readonly deferred: Deferred.Deferred<Blob, AssetLoadFailed | LoadStalled>
  readonly fiber: Fiber.RuntimeFiber<void, never>
  waiters: number
}

/**
 * Creates the Assets service.
 * Manages single-flight asset downloads, byte progress reporting,
 * and font readiness under the load meter stall rule.
 *
 * Note: AF does not use Pixi's loader, so FloorFifty's abandon workaround
 * for Pixi's internal promise cache is not needed; interrupting the Effect fiber
 * cleanly aborts the underlying fetch.
 */
export const makeAssets = (options: MakeAssetsOptions): Effect.Effect<Assets> =>
  Effect.sync(() => {
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

    const loadFile = (url: string): Effect.Effect<Blob, AssetLoadFailed | LoadStalled> => {
      const cachedBlob = blobs.get(url)
      if (cachedBlob) return Effect.succeed(cachedBlob)

      return Effect.gen(function* () {
        let entry = inFlightFiles.get(url)

        if (!entry) {
          const deferred = yield* Deferred.make<Blob, AssetLoadFailed | LoadStalled>()

          const worker: Effect.Effect<void, never> = options.meter
            .guard(
              Effect.tryPromise({
                try: async (signal) => {
                  let response: Response
                  try {
                    response = await fetchFn(url, { signal })
                  } catch (err) {
                    if (signal.aborted) throw err
                    throw new AssetLoadFailed({ url, status: 0 })
                  }

                  if (!response.ok) {
                    throw new AssetLoadFailed({ url, status: response.status })
                  }

                  fileProgress.set(url, {
                    received: 0,
                    total: undefined,
                    done: false,
                  })

                  const blob = await readBlob(response, 'application/octet-stream', (p) => {
                    fileProgress.set(url, {
                      received: p.received,
                      total: p.total,
                      done: false,
                    })
                    options.meter.progress()
                    notifyScreensForFile(url)
                  })

                  fileProgress.set(url, {
                    received: blob.size,
                    total: blob.size,
                    done: true,
                  })
                  blobs.set(url, blob)
                  notifyScreensForFile(url)
                  return blob
                },
                catch: (err) => {
                  if (err instanceof AssetLoadFailed) return err
                  return new AssetLoadFailed({ url, status: 0 })
                },
              }),
              {
                url,
                bytesSoFar: () => fileProgress.get(url)?.received ?? 0,
              },
            )
            .pipe(
              Effect.matchEffect({
                onSuccess: (blob) =>
                  Effect.sync(() => {
                    inFlightFiles.delete(url)
                  }).pipe(Effect.andThen(Deferred.succeed(deferred, blob))),
                onFailure: (err) =>
                  Effect.sync(() => {
                    inFlightFiles.delete(url)
                    fileProgress.delete(url)
                  }).pipe(Effect.andThen(Deferred.fail(deferred, err))),
              }),
            )

          const fiber = yield* Effect.fork(worker)
          entry = { deferred, fiber, waiters: 0 }
          inFlightFiles.set(url, entry)
        }

        entry.waiters++
        const currentEntry = entry

        return yield* Deferred.await(currentEntry.deferred).pipe(
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              currentEntry.waiters--
              if (currentEntry.waiters === 0) {
                inFlightFiles.delete(url)
                fileProgress.delete(url)
              }
            }).pipe(
              Effect.andThen(currentEntry.waiters === 0 ? Fiber.interrupt(currentEntry.fiber) : Effect.void),
            ),
          ),
        )
      })
    }

    const isLoaded = (screen: string): boolean => loadedScreens.has(screen)

    const get = (path: string): Blob | undefined => blobs.get(path)

    const load = (
      screen: string,
      onProgress?: (fraction: number | undefined) => void,
    ): Effect.Effect<void, AssetLoadFailed | LoadStalled> =>
      Effect.gen(function* () {
        if (loadedScreens.has(screen)) {
          onProgress?.(1)
          return
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

        try {
          // Load files in parallel
          if (files.length > 0) {
            yield* Effect.all(
              files.map((file) => loadFile(file)),
              {
                concurrency: 'unbounded',
              },
            )
          }

          // Load fonts
          if (fontList.length > 0 && options.fontFaces) {
            yield* Effect.all(
              fontList.map((font) =>
                options.meter.guard(
                  Effect.tryPromise({
                    try: () => options.fontFaces!.load(font),
                    catch: () => new AssetLoadFailed({ url: font, status: 0 }),
                  }),
                  { url: font },
                ),
              ),
              { concurrency: 'unbounded' },
            )
          }

          loadedScreens.add(screen)
          if (onProgress) {
            onProgress(1)
          }
        } finally {
          if (onProgress) {
            listeners.delete(onProgress)
          }
        }
      })

    return { load, get, isLoaded }
  })
