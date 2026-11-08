import type { Hosting, HostingOptions } from '../../host/hosting.ts'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'

export type PauseBehavior = HostingOptions['pauseBehavior']
/**
 * `input`: the active pad was unplugged during play; Resume on the pause screen clears it. `display`: a phone
 * is held the other way from the game's orientation; turning it back clears it.
 */
export type PauseReason = 'lifecycle' | 'menu' | 'input' | 'display'

/** The time service: whether the sim is paused, and why; each reason pauses until it is resumed. */
export interface Time {
  readonly paused: boolean
  readonly reasons: ReadonlySet<PauseReason>
  pause(reason: PauseReason): void
  resume(reason: PauseReason): void
}

export function createTime(bus: PresentationBus): Time {
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
  readonly hosting: Pick<Hosting, 'lifecycle'>
  readonly time: Time
  readonly pauseBehavior: PauseBehavior
  readonly document?: Document
  readonly openMenu: () => void
}

/**
 * Pauses the sim (`lifecycle`) while the host is in the background or the page is hidden, and opens the menu as it
 * goes; coming back clears the reason but leaves the menu open, so play never resumes on its own. Does nothing under
 * `pauseBehavior: 'continue'`. Returns the function that stops watching.
 */
export function watchLifecycle(options: WatchLifecycleOptions): () => void {
  if (options.pauseBehavior === 'continue') return () => undefined

  const doc = options.document ?? (typeof document !== 'undefined' ? document : undefined)
  let hostBackground = options.hosting.lifecycle.get().state === 'background'
  let docHidden = doc?.visibilityState === 'hidden'
  let inBackground = false

  const update = (): void => {
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
  update()

  const onVisibilityChange = (): void => {
    docHidden = doc?.visibilityState === 'hidden'
    update()
  }
  doc?.addEventListener('visibilitychange', onVisibilityChange)
  // `subscribe` hears the current value first, which `update` has already seen: it changes nothing.
  const stopHost = options.hosting.lifecycle.subscribe((payload) => {
    hostBackground = payload.state === 'background'
    update()
  })

  return () => {
    stopHost()
    doc?.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
