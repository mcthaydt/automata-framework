import type { Hosting } from '@mcthaydt/automata-host'
import type { Effect, Scope } from 'effect'
import type { Audio } from '../audio/audio.manager.js'
import type { AudioBuses } from '../audio/audio-buses.js'
import type { AssetLoadFailed, LoadStalled } from '../boot/boot-error.js'
import type { Haptics } from '../haptics/haptics.manager.js'
import type { Leaderboards } from '../leaderboards/leaderboards.manager.js'
import type { Assets } from '../loading/assets.manager.js'
import type { Locale } from '../locale/locale.manager.js'
import type { AppLoop } from '../loop/app-loop.manager.js'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'
import type { GameRenderer } from '../render/renderer.js'
import type { Saves } from '../save/saves.manager.js'
import type { Settings } from '../settings/settings.manager.js'
import type { Time } from '../time/time.manager.js'
import type { Flow } from './flow.manager.js'

export interface ScreenContext {
  readonly layer: HTMLElement
  readonly from: string | undefined
  /**
   * The scope of what a game keeps across screens, such as the sim the default screens share (DX.2c). Every screen
   * of a run gets the same one. It stays open through every transition and closes once, when the runtime shuts down
   * or a failed boot is tried again: after the current screen's scope and the save's last flush, which may still read
   * what it holds, and before the renderer is destroyed and Hosting closes.
   */
  readonly runtime: Scope.Scope
}

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

export interface ScreenDef<R = never> {
  readonly id: string
  readonly pausesSim?: boolean
  /** `gameplay` lets the cursor policy hide an idle pointer; a `menu` (the default) never does (M4 spec §4.7). */
  readonly kind?: 'menu' | 'gameplay'
  readonly fonts?: readonly string[]
  enter(context: ScreenContext): Effect.Effect<void, unknown, Scope.Scope | RuntimeServices | R>
  openMenu?(): boolean
}

export type FlowFailure =
  | AssetLoadFailed
  | LoadStalled
  | { readonly _tag: 'ScreenFailed'; readonly screen: string; readonly cause: unknown }
