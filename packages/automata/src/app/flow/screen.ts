import type { Effect, Scope } from 'effect'
import type { Audio } from '../../features/audio/audio.manager.js'
import type { AudioBuses } from '../../features/audio/audio-buses.js'
import type { Haptics } from '../../features/input/haptics/haptics.manager.js'
import type { Leaderboards } from '../../features/leaderboards/leaderboards.manager.js'
import type { Locale } from '../../features/locale/locale.manager.js'
import type { Saves } from '../../features/saves/saves.manager.js'
import type { Hosting } from '../../shared/host/hosting.ts'
import type { Assets } from '../../shared/runtime/assets.manager.js'
import type { AssetLoadFailed, LoadStalled } from '../../shared/runtime/boot-error.js'
import type { AppLoop } from '../../shared/runtime/loop/app-loop.manager.js'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import type { GameRenderer } from '../../shared/runtime/render/renderer.js'
import type { Settings } from '../../shared/runtime/settings/settings.manager.js'
import type { Time } from '../../shared/runtime/time/time.manager.js'
import type { Flow } from './flow.manager.js'

/** What a screen's `enter` is given: the layer to mount into, and the screen it came from. */
export interface ScreenContext {
  readonly layer: HTMLElement
  readonly from: string | undefined
  /**
   * The scope of what a game keeps across screens, such as the sim the default screens share. Every screen
   * of a run gets the same one. It is a child of the runtime scope, not the runtime scope itself. It stays open
   * through every transition and closes once, when the runtime shuts down or a failed boot is tried again: after the
   * current screen's scope and the save's last flush, which may still read what it holds, and before the renderer is
   * destroyed and Hosting closes.
   */
  readonly runtime: Scope.Scope
}

/** The runtime services a screen's `enter` may use. */
export type RuntimeServices =
  | Hosting
  | PresentationBus
  | Time
  | Flow
  | Settings
  | Saves
  | AppLoop
  | Assets
  | GameRenderer
  | Locale
  | Audio
  | AudioBuses
  | Leaderboards
  | Haptics

/**
 * One screen of the flow: its id, whether it pauses the sim, its kind and fonts, and `enter`, which mounts it
 * in its scope (closing the scope leaves the screen).
 */
export interface ScreenDef<R = never> {
  readonly id: string
  readonly pausesSim?: boolean
  /** `gameplay` lets the cursor policy hide an idle pointer; a `menu` (the default) never does. */
  readonly kind?: 'menu' | 'gameplay'
  readonly fonts?: readonly string[]
  enter(context: ScreenContext): Effect.Effect<void, unknown, Scope.Scope | RuntimeServices | R>
  openMenu?(): boolean
}

/** Why entering a screen failed: an asset load, a stalled download, or the screen's own failure. */
export type FlowFailure =
  | AssetLoadFailed
  | LoadStalled
  | { readonly _tag: 'ScreenFailed'; readonly screen: string; readonly cause: unknown }
