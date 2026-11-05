import type { SimEvent } from '@mcthaydt/automata-sim'
import { Context, Effect, type Scope } from 'effect'
import type { ErrorCode } from '../../host/error-code.schema.ts'
import type { BoardState } from '../board-state.js'
import type { GlyphFamily } from '../glyph-family.js'
import type { InputDevice, PadInfo } from '../input-device.js'

/** Every fact the runtime publishes on the presentation bus, by name. */
export interface RuntimeFacts {
  readonly 'sim.events': readonly SimEvent[]
  /**
   * The same events with the tick of the step that emitted them (`StepResult.tick`, the tick the sim is at after the step), for
   * a listener that needs to know when an event happened. Published with `sim.events`, only when the step emitted events.
   */
  readonly 'sim.step': { readonly tick: number; readonly events: readonly SimEvent[] }
  readonly 'screen.entered': {
    readonly screen: string
    readonly from: string | undefined
  }
  readonly 'time.changed': { readonly paused: boolean }
  /** The player's language changed. Screens redraw their text; nothing remounts. */
  readonly 'locale.changed': { readonly locale: string; readonly previous: string }
  /** The player's last real input came from another device. Prompts and touch controls follow it. */
  readonly 'input.device.changed': {
    readonly device: InputDevice
    readonly glyphs: GlyphFamily
    readonly previous: InputDevice
  }
  /** The first gesture after `session.ready` built and resumed the audio graph. */
  readonly 'audio.unlocked': Readonly<Record<never, never>>
  /** No audio context could be built or resumed; the game runs silent. */
  readonly 'audio.unavailable': { readonly reason: string }
  /** A sound or a track could not be loaded or decoded; it is silent and nothing else stops. */
  readonly 'audio.decode.failed': { readonly alias: string; readonly reason: string }
  /** A pad was plugged in. `standard: false` means it cannot drive bindings. */
  readonly 'input.pad.connected': PadInfo
  /** A pad was unplugged; what it held is released. `wasActive`: it was the pad in use. */
  readonly 'input.pad.disconnected': PadInfo & { readonly wasActive: boolean }
  /** The player's bindings changed: `action` when one was rebound, none on a reset or a follow. */
  readonly 'input.bindings.changed': { readonly action?: string }
  /** A post filter could not be built or compiled and was left out; the frame draws without it. */
  readonly 'render.filter.dropped': { readonly id: string; readonly reason: string }
  /** The WebGL context was lost; the renderer draws nothing until it is restored. */
  readonly 'render.context.lost': Readonly<Record<never, never>>
  /**
   * The WebGL context came back: Pixi re-uploads its GPU resources and the renderer draws again; the
   * views and the sim are untouched.
   */
  readonly 'render.context.restored': Readonly<Record<never, never>>
  /** A slot's save reached the host. `key` is the save's prefix (`SaveDef.key`). */
  readonly 'save.written': { readonly key: string; readonly slot: number }
  /** The host refused a slot's write; the slot keeps its previous value. */
  readonly 'save.failed': { readonly key: string; readonly slot: number; readonly code: ErrorCode }
  /** A slot was loaded for play. */
  readonly 'save.loaded': { readonly key: string; readonly slot: number }
  /**
   * Another device changed the slot being played. Nothing was reloaded; the game offers Load
   * newer or Keep playing.
   */
  readonly 'save.changedElsewhere': { readonly key: string; readonly slot: number }
  /** A submit to `board` changed state: `submitting`, then how the host answered. */
  readonly 'leaderboard.submitted': { readonly board: string; readonly state: BoardState }
}

/**
 * The presentation bus: typed facts the runtime publishes for screens, audio and tests to hear. Facts
 * describe what happened; they never change gameplay state.
 */
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

/** Builds the bus. `dispose()` drops every listener and every queued fact; later publishes do nothing. */
export function createPresentationBus(
  log: (error: unknown) => void = console.error,
): PresentationBus & { dispose(): void } {
  const listeners = new Map<string, Set<(fact: any) => void>>()
  const queue: QueuedFact[] = []
  let delivering = false
  let closed = false

  return {
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

    dispose() {
      closed = true
      queue.length = 0
      listeners.clear()
    },
  }
}

/** TEMPORARY (task 5.4): the bus living as long as an Effect scope, for the parts of boot not yet converted. */
export function makePresentationBus(
  log: (error: unknown) => void = console.error,
): Effect.Effect<PresentationBus, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => createPresentationBus(log)),
    (bus) => Effect.sync(() => bus.dispose()),
  )
}

/**
 * Cast a PresentationBus instance to a typed view with game-specific fact types.
 * Safe because PresentationBus stores facts dynamically by string key.
 */
export function typedBus<GameFacts>(bus: PresentationBus<object>): PresentationBus<GameFacts> {
  return bus as unknown as PresentationBus<GameFacts>
}
