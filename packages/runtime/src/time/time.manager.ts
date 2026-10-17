import type { Hosting, HostingOptions } from '@mcthaydt/automata-host'
import { Context, Effect, type Scope, Stream } from 'effect'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'

export type PauseBehavior = HostingOptions['pauseBehavior']
/** `input`: the active pad was unplugged during play (M4-D9); Resume on the pause screen clears it. */
export type PauseReason = 'lifecycle' | 'menu' | 'input'

export interface Time {
  readonly paused: boolean
  readonly reasons: ReadonlySet<PauseReason>
  pause(reason: PauseReason): void
  resume(reason: PauseReason): void
}

export const Time: Context.Tag<Time, Time> = Context.GenericTag<Time>('@mcthaydt/automata-runtime/Time')

export function makeTime(bus: PresentationBus): Time {
  const reasons = new Set<PauseReason>()

  return {
    get paused(): boolean {
      return reasons.size > 0
    },
    get reasons(): ReadonlySet<PauseReason> {
      return reasons
    },
    pause(reason: PauseReason): void {
      const wasPaused = reasons.size > 0
      reasons.add(reason)
      const isPaused = reasons.size > 0
      if (!wasPaused && isPaused) {
        bus.publish('time.changed', { paused: true })
      }
    },
    resume(reason: PauseReason): void {
      const wasPaused = reasons.size > 0
      reasons.delete(reason)
      const isPaused = reasons.size > 0
      if (wasPaused && !isPaused) {
        bus.publish('time.changed', { paused: false })
      }
    },
  }
}

export interface WatchLifecycleOptions {
  readonly hosting: Hosting
  readonly time: Time
  readonly pauseBehavior: PauseBehavior
  readonly document?: Document
  readonly openMenu: () => void
}

export function watchLifecycle(options: WatchLifecycleOptions): Effect.Effect<void, never, Scope.Scope> {
  if (options.pauseBehavior === 'continue') {
    return Effect.void
  }

  return Effect.gen(function* () {
    const doc = options.document ?? (typeof document !== 'undefined' ? document : undefined)

    const initial = yield* options.hosting.lifecycle.get
    let hostBackground = initial.state === 'background'
    let docHidden = doc?.visibilityState === 'hidden'
    let inBackground = hostBackground || docHidden

    const update = (newHostBg: boolean, newDocHidden: boolean) => {
      hostBackground = newHostBg
      docHidden = newDocHidden
      const shouldPause = hostBackground || docHidden

      if (shouldPause && !inBackground) {
        inBackground = true
        options.time.pause('lifecycle')
        options.openMenu()
      } else if (!shouldPause && inBackground) {
        inBackground = false
        options.time.resume('lifecycle')
      }
    }

    if (inBackground) {
      options.time.pause('lifecycle')
      options.openMenu()
    }

    // 1. Listen to document visibilitychange
    if (doc) {
      const onVisibilityChange = () => {
        update(hostBackground, doc.visibilityState === 'hidden')
      }
      doc.addEventListener('visibilitychange', onVisibilityChange)
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          doc.removeEventListener('visibilitychange', onVisibilityChange)
        }),
      )
    }

    // 2. Stream hosting.lifecycle.changes in a scoped fiber
    yield* Stream.runForEach(options.hosting.lifecycle.changes, (payload) =>
      Effect.sync(() => {
        update(payload.state === 'background', docHidden)
      }),
    ).pipe(Effect.forkScoped)
  })
}
