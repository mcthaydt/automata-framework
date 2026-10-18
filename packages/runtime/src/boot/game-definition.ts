import type { AssetsSource, FlowGraph, GameSource } from '@mcthaydt/automata-content'
import type { HostingOptions, HostingSeams } from '@mcthaydt/automata-host'
import type { BootFailureCopy } from '@mcthaydt/automata-ui'
import type { AudioContextLike } from '../audio/audio-graph.js'
import type { EventSounds } from '../audio/event-sounds.js'
import type { GameOrientation } from '../display/display-policy.svelte.js'
import type { ExtensionDef } from '../extension/define-extension.js'
import type { ScreenDef } from '../flow/screen.js'
import type { Haptics } from '../haptics/haptics.manager.js'
import type { EventScores } from '../leaderboards/event-scores.js'
import type { LocaleDef } from '../locale/locale.manager.js'
import type { FrameSource } from '../loop/frames.js'
import type { RendererFactory } from '../render/renderer.js'
import type { SettingsDef } from '../settings/settings.manager.js'

/** The compiled JSON content read by the runtime (spec §3.3). */
export interface CompiledContentData {
  readonly flow: FlowGraph
  readonly assets?: AssetsSource | undefined
  readonly game?: GameSource | undefined
  readonly [key: string]: unknown
}

/** Test seams injected into the runtime boot program (spec §3.3, planning note 10). */
export interface RuntimeSeams {
  readonly fetch?: typeof fetch
  readonly frames?: FrameSource
  readonly fonts?: Pick<FontFaceSet, 'load'>
  readonly sdkEnv?: () => NonNullable<HostingSeams['env']>
  readonly document?: Document
  /** The browser's languages, best first; defaults to `navigator.languages`. */
  readonly languages?: readonly string[]
  /** Builds the audio context on the unlock; defaults to `new AudioContext()`. */
  readonly createAudioContext?: () => AudioContextLike
  /** The device's haptics, in place of the browser's (pads, `navigator.vibrate`, a coarse pointer). */
  readonly haptics?: Haptics
}

/** Controls the running game: shutdown closes the runtime scope (spec §3.3, planning note 11). */
export interface RuntimeHandle {
  shutdown(): Promise<void>
}

/** Everything a game provides to the runtime to boot (spec §3.3). */
export interface GameDefinition<S = never> {
  readonly root: HTMLElement
  readonly hosting: Omit<HostingOptions, 'disclosedEvents'>
  readonly content: { readonly data: CompiledContentData; readonly hash: string }
  readonly screens: readonly ScreenDef[]
  readonly renderer: RendererFactory
  readonly settings?: SettingsDef<S> | undefined
  /**
   * The orientation the game plays in, as the ship config's `runtime.orientation` says (M4.7). A `portrait` or
   * `landscape` game on a phone held the other way pauses behind the rotate hint. Default `any`.
   */
  readonly orientation?: GameOrientation | undefined
  /**
   * The game's languages: pass its Paraglide `runtime.js` (`import * as runtime from './paraglide/runtime.js'`).
   * Absent, the game has one locale, the content's `source_language` (PRODUCT spec §4).
   */
  readonly locale?: LocaleDef | undefined
  readonly extensions?: readonly ExtensionDef[] | undefined
  /** The sound each sim event plays, by the event's type (M5.3). */
  readonly sounds?: EventSounds | undefined
  /** The board and score each sim event submits, by the event's type (M5.7). Needs the `leaderboards` grant. */
  readonly scores?: EventScores | undefined
  readonly copy?: Partial<BootFailureCopy> & {
    readonly loading?: string
    readonly slow?: string
  }
  readonly seams?: RuntimeSeams
}
