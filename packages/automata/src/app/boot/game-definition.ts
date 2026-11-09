import type { AssetsSource, FlowGraph, GameSource } from '@automataframework/automata-content'
import type { AudioContextLike } from '../../features/audio/audio-graph.js'
import type { EventSounds } from '../../features/audio/event-sounds.js'
import type { GameOrientation, RotateHintMode } from '../../features/display/display-policy.svelte.js'
import type { ExtensionDef } from '../../features/extension/define-extension.js'
import type { Haptics } from '../../features/input/haptics/haptics.manager.js'
import type { EventScores } from '../../features/leaderboards/event-scores.js'
import type { LocaleDef } from '../../features/locale/locale.manager.js'
import type { SaveDef } from '../../features/saves/save.schema.js'
import type { HostResult } from '../../shared/host/errors.ts'
import type { Hosting, HostingOptions, HostingSeams } from '../../shared/host/hosting.ts'
import type { Clock } from '../../shared/lib/clock.ts'
import type { FrameSource } from '../../shared/runtime/loop/frames.js'
import type { RendererFactory } from '../../shared/runtime/render/renderer.js'
import type { DeviceStorage } from '../../shared/runtime/settings/device-storage.js'
import type { SettingsDef } from '../../shared/runtime/settings/settings.manager.js'
import type { BootFailureCopy } from '../../shared/ui/status/boot-failure.ts'
import type { ScreenDef } from '../flow/screen.js'

/** The compiled JSON content read by the runtime. */
export interface CompiledContentData {
  readonly flow: FlowGraph
  readonly assets?: AssetsSource | undefined
  readonly game?: GameSource | undefined
  readonly [key: string]: unknown
}

/** Test seams injected into the runtime boot program. */
export interface RuntimeSeams {
  readonly fetch?: typeof fetch
  readonly frames?: FrameSource
  readonly fonts?: Pick<FontFaceSet, 'load'>
  readonly sdkEnv?: () => NonNullable<HostingSeams['env']>
  /**
   * Builds the game's `Hosting` in place of the build target's adapter (`@automataframework/automata/target`), for example
   * `fakeHosting(…).open` from `@automataframework/automata/testing`. It gets boot's clock and the signal that gives up the
   * handshake; boot disposes what it answers. When given, `sdkEnv` is not used.
   */
  readonly hosting?: (
    options: HostingOptions,
    seams: { readonly clock: Clock; readonly signal: AbortSignal },
  ) => Promise<HostResult<Hosting>>
  /** The clock every runtime timer runs on (the stall rule, fades, toasts, the exit cap); default the real one. */
  readonly clock?: Clock
  /** The wall clock saves are stamped with, in epoch milliseconds; default `Date.now`. */
  readonly now?: () => number
  readonly document?: Document
  /** The browser's languages, best first; defaults to `navigator.languages`. */
  readonly languages?: readonly string[]
  /** Builds the audio context on the unlock; defaults to `new AudioContext()`. */
  readonly createAudioContext?: () => AudioContextLike
  /** The device's haptics, in place of the browser's (pads, `navigator.vibrate`, a coarse pointer). */
  readonly haptics?: Haptics
  /** Where settings fields that belong to the device are kept; defaults to the frame's `localStorage`. */
  readonly deviceStorage?: DeviceStorage
  /**
   * Hears what failed, after the runtime has shown it as usual: a boot failure's `BootError`, why a screen could not
   * load or enter, or what a running sim's step threw. Each Try again can fail again, so it can be called more than
   * once. A throw from it is ignored. The website's playground reports the line in the reader's code
   * from it.
   */
  readonly onFailure?: (cause: unknown) => void
  /**
   * Reloads the game's frame: what Try again does after a boot failure inside a Ruken session, where the host answers
   * one hello per frame load. Defaults to reloading the document's location.
   */
  readonly reload?: () => void
}

/** Controls the running game: `shutdown` closes everything the runtime opened, last opened first. */
export interface RuntimeHandle {
  /** The screen showing now; `undefined` before the flow starts and after shutdown. */
  readonly screen: string | undefined
  shutdown(): Promise<void>
}

/** How a game starts. */
export interface StartOptions {
  /**
   * The screen to start on instead of the flow's entry, for a restart in development that brings the person back
   * where they were (a tuning change restarts the game on new content). A screen the flow does not have starts at
   * the entry. The start screen's assets load as it enters, as any screen's do after boot.
   */
  readonly at?: string | undefined
}

/** Everything a game provides to the runtime to boot. */
export interface GameDefinition<S = never> {
  readonly root: HTMLElement
  readonly hosting: Omit<HostingOptions, 'disclosedEvents'>
  readonly content: { readonly data: CompiledContentData; readonly hash: string }
  readonly screens: readonly ScreenDef[]
  /**
   * Files fetched with the preload screens' own (byte progress, the 30 s stall rule) before the renderer starts,
   * outside the content: a game without `content/` lists its 3D models here. They are not part of
   * `content.hash`, so a new origin or a rebuilt file never changes the hash saves are stamped with.
   */
  readonly preload?: readonly string[] | undefined
  readonly renderer: RendererFactory
  readonly settings?: SettingsDef<S> | undefined
  /**
   * The game's save: its slots, autosave and migrations. Boot opens it, wires its triggers and flushes it when
   * the host closes the game; a screen reaches it with `saveOf(def)`. Absent, the game has no save and the runtime
   * reads and writes nothing for one.
   */
  readonly saves?: SaveDef<unknown> | undefined
  /**
   * The orientation the game plays in, as the ship config's `runtime.orientation` says. A `portrait` or
   * `landscape` game on a phone held the other way pauses behind the rotate hint. Default `any`.
   */
  readonly orientation?: GameOrientation | undefined
  /** How a locked orientation says so on a phone held the other way: `'block'` (the default) or `'toast'`. */
  readonly rotateHint?: RotateHintMode | undefined
  /**
   * The game's languages: pass its Paraglide `runtime.js` (`import * as runtime from './paraglide/runtime.js'`).
   * Absent, the game has one locale, the content's `source_language`.
   */
  readonly locale?: LocaleDef | undefined
  readonly extensions?: readonly ExtensionDef[] | undefined
  /** The sound each sim event plays, by the event's type. */
  readonly sounds?: EventSounds | undefined
  /** The board and score each sim event submits, by the event's type. Needs the `leaderboards` grant. */
  readonly scores?: EventScores | undefined
  readonly copy?: Partial<BootFailureCopy> & {
    readonly loading?: string
    readonly slow?: string
    /** The panel when the renderer's graphics context is lost for good. */
    readonly contextLost?: string
  }
  readonly seams?: RuntimeSeams
}
