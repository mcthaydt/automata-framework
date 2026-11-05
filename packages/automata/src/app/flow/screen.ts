import type { Audio } from '../../features/audio/audio.manager.ts'
import type { AudioBuses } from '../../features/audio/audio-buses.ts'
import type { Haptics } from '../../features/input/haptics/haptics.manager.js'
import type { Leaderboards } from '../../features/leaderboards/leaderboards.manager.js'
import type { Locale } from '../../features/locale/locale.manager.js'
import type { Saves } from '../../features/saves/saves.manager.js'
import type { Hosting } from '../../shared/host/plain-hosting.ts'
import type { Clock } from '../../shared/lib/clock.ts'
import type { Disposables } from '../../shared/lib/disposables.ts'
import type { Assets } from '../../shared/runtime/assets.manager.js'
import type { AssetLoadFailed, LoadStalled } from '../../shared/runtime/boot-error.js'
import type { AppLoop } from '../../shared/runtime/loop/app-loop.manager.js'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import type { GameRenderer } from '../../shared/runtime/render/renderer.js'
import type { Settings } from '../../shared/runtime/settings/settings.manager.js'
import type { Time } from '../../shared/runtime/time/time.manager.js'
import type { Flow } from './flow.manager.js'

/** The runtime services a screen may use, as one plain object: boot builds them in order and hands them over. */
export interface RuntimeServices {
  readonly hosting: Hosting
  readonly bus: PresentationBus
  /** The runtime's clock: what a screen waits on (a toast's four seconds, a rebind's countdown). */
  readonly clock: Clock
  readonly time: Time
  readonly flow: Flow
  readonly settings: Settings
  readonly saves: Saves
  readonly appLoop: AppLoop
  readonly assets: Assets
  readonly renderer: GameRenderer
  readonly locale: Locale
  /** Sounds and music, and the audio buses' gains (one service). */
  readonly audio: Audio & AudioBuses
  readonly leaderboards: Leaderboards
  readonly haptics: Haptics
}

/** What a screen's `enter` is given: where to mount, where it came from, what to undo, and the runtime's services. */
export interface ScreenContext {
  /** The screen's own element in the screen layer. */
  readonly layer: HTMLElement
  readonly from: string | undefined
  /**
   * What the screen undoes when it is left: add a function for each listener, mount or timer it starts. The flow
   * disposes it once, last added first, before the next screen enters (and when a failed `enter` is cleaned up).
   */
  readonly screen: Disposables
  /**
   * What a game keeps across screens, such as the sim the default screens share. Every screen of a run gets the same
   * one. It is disposed once, when the runtime shuts down or a failed boot is tried again: after the current screen
   * and the save's last flush, which may still read what it holds, and before the renderer is destroyed and Hosting
   * closes.
   */
  readonly runtime: Disposables
  readonly services: RuntimeServices
}

/**
 * One screen of the flow: its id, whether it pauses the sim, its kind and fonts, and `enter`, which mounts it.
 * Everything `enter` starts goes in `context.screen`, which the flow disposes when the screen is left.
 */
export interface ScreenDef {
  readonly id: string
  readonly pausesSim?: boolean
  /** `gameplay` lets the cursor policy hide an idle pointer; a `menu` (the default) never does. */
  readonly kind?: 'menu' | 'gameplay'
  readonly fonts?: readonly string[]
  /** A throw, or a rejected promise, is the screen's failure: the flow shows the error panel with Try again. */
  enter(context: ScreenContext): void | Promise<void>
  openMenu?(): boolean
}

/** Why entering a screen failed: an asset load, a stalled download, or the screen's own failure. */
export type FlowFailure =
  | AssetLoadFailed
  | LoadStalled
  | { readonly _tag: 'ScreenFailed'; readonly screen: string; readonly cause: unknown }
