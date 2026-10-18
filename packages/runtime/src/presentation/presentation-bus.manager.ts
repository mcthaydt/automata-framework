import type { ErrorCode } from '@mcthaydt/automata-host'
import type { SimEvent } from '@mcthaydt/automata-sim'
import { Context, Effect, type Scope } from 'effect'
import type { GlyphFamily } from '../input/gamepad/glyph-family.js'
import type { InputDevice, PadInfo } from '../input/input.manager.js'

export interface RuntimeFacts {
  readonly 'sim.events': readonly SimEvent[]
  readonly 'screen.entered': {
    readonly screen: string
    readonly from: string | undefined
  }
  readonly 'time.changed': { readonly paused: boolean }
  /** The player's language changed (PRODUCT spec §4 item 2). Screens redraw their text; nothing remounts. */
  readonly 'locale.changed': { readonly locale: string; readonly previous: string }
  /** The player's last real input came from another device (M4 spec §4.2). Prompts and touch controls follow it. */
  readonly 'input.device.changed': {
    readonly device: InputDevice
    readonly glyphs: GlyphFamily
    readonly previous: InputDevice
  }
  /** The first gesture after `session.ready` built and resumed the audio graph (M5 spec §4.6). */
  readonly 'audio.unlocked': Readonly<Record<never, never>>
  /** No audio context could be built or resumed; the game runs silent (M5 spec §6). */
  readonly 'audio.unavailable': { readonly reason: string }
  /** A sound or a track could not be loaded or decoded; it is silent and nothing else stops (M5 spec §6). */
  readonly 'audio.decode.failed': { readonly alias: string; readonly reason: string }
  /** A pad was plugged in (M4 spec §5). `standard: false` means it cannot drive bindings (§6). */
  readonly 'input.pad.connected': PadInfo
  /** A pad was unplugged; what it held is released (M4 spec §5). `wasActive`: it was the pad in use. */
  readonly 'input.pad.disconnected': PadInfo & { readonly wasActive: boolean }
  /** A post filter could not be built or compiled and was left out; the frame draws without it (M4 spec §6). */
  readonly 'render.filter.dropped': { readonly id: string; readonly reason: string }
  /** A slot's save reached the host (M5 spec §4.3). `key` is the save's prefix (`SaveDef.key`). */
  readonly 'save.written': { readonly key: string; readonly slot: number }
  /** The host refused a slot's write; the slot keeps its previous value (M5 spec §4.3, §6). */
  readonly 'save.failed': { readonly key: string; readonly slot: number; readonly code: ErrorCode }
  /** A slot was loaded for play (M5 spec §5, "Load a slot"). */
  readonly 'save.loaded': { readonly key: string; readonly slot: number }
}

export interface PresentationBus<Facts = RuntimeFacts> {
  publish<K extends keyof Facts & string>(name: K, fact: Facts[K]): void
  subscribe<K extends keyof Facts & string>(name: K, listener: (fact: Facts[K]) => void): () => void
}

export const PresentationBus: Context.Tag<PresentationBus, PresentationBus> =
  Context.GenericTag<PresentationBus>('@mcthaydt/automata-runtime/PresentationBus')

interface QueuedFact {
  readonly name: string
  readonly fact: unknown
}

export function makePresentationBus(
  log: (error: unknown) => void = console.error,
): Effect.Effect<PresentationBus, never, Scope.Scope> {
  return Effect.gen(function* () {
    const listeners = new Map<string, Set<(fact: any) => void>>()
    const queue: QueuedFact[] = []
    let delivering = false
    let closed = false

    const close = () => {
      closed = true
      queue.length = 0
      listeners.clear()
    }

    yield* Effect.addFinalizer(() => Effect.sync(close))

    const bus: PresentationBus = {
      publish(name, fact) {
        if (closed) return
        queue.push({ name, fact })
        if (delivering) return

        delivering = true
        try {
          while (queue.length > 0) {
            if (closed) break
            const current = queue.shift()!
            const set = listeners.get(current.name)
            if (!set || set.size === 0) continue

            // Snapshot the listeners set so additions during delivery do not run immediately,
            // but check membership before calling so unsubscribed listeners do not run.
            const snapshot = Array.from(set)
            for (const listener of snapshot) {
              if (closed) break
              if (!set.has(listener)) continue
              try {
                listener(current.fact)
              } catch (err) {
                try {
                  log(err)
                } catch {
                  // Do not let logger failures derail bus delivery
                }
              }
            }
          }
        } finally {
          delivering = false
        }
      },

      subscribe(name, listener) {
        if (closed) return () => {}
        let set = listeners.get(name)
        if (!set) {
          set = new Set()
          listeners.set(name, set)
        }
        set.add(listener)

        let unsubscribed = false
        return () => {
          if (unsubscribed) return
          unsubscribed = true
          set?.delete(listener)
          if (set?.size === 0) {
            listeners.delete(name)
          }
        }
      },
    }

    return bus
  })
}

/**
 * Cast a PresentationBus instance to a typed view with game-specific fact types.
 * Safe because PresentationBus stores facts dynamically by string key.
 */
export function typedBus<GameFacts>(bus: PresentationBus<object>): PresentationBus<GameFacts> {
  return bus as unknown as PresentationBus<GameFacts>
}
