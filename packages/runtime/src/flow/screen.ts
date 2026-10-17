import type { Hosting } from '@mcthaydt/automata-host'
import type { Effect, Scope } from 'effect'
import type { AssetLoadFailed, LoadStalled } from '../boot/boot-error.js'
import type { Assets } from '../loading/assets.manager.js'
import type { Locale } from '../locale/locale.manager.js'
import type { AppLoop } from '../loop/app-loop.manager.js'
import type { PresentationBus } from '../presentation/presentation-bus.manager.js'
import type { GameRenderer } from '../render/renderer.js'
import type { Settings } from '../settings/settings.manager.js'
import type { Time } from '../time/time.manager.js'
import type { Flow } from './flow.manager.js'

export interface ScreenContext {
  readonly layer: HTMLElement
  readonly from: string | undefined
}

export type RuntimeServices =
  | Hosting
  | PresentationBus
  | Time
  | Flow
  | Settings
  | AppLoop
  | Assets
  | GameRenderer
  | Locale

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
