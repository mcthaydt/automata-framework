import type {
  AdBreakRes,
  AudioChange,
  Capability,
  DisplayMetricsPayload,
  FullscreenRes,
  LifecyclePayload,
  LinksOpenRes,
  PauseBehavior,
  RoundOutcome,
  SavesStatus,
  SavesStorage,
} from '@ruken/sdk'
import type { Effect, Scope, Stream } from 'effect'
import { Context } from 'effect'
import type { CapabilityDenied, HostRequestFailed } from './errors'

/** What the game asks of its host (M1.4 spec §3.1). In M1 the game passes these by hand. */
export interface HostingOptions {
  /** `[game].id` in ruken.toml; the host checks it. */
  readonly gameId: string
  /** The capabilities the game asks the host for. */
  readonly wants: readonly Capability[]
  /** Fixed for the game's whole life (Ruken's answer 7 in docs/spikes/s6-ruken-stub.md). */
  readonly pauseBehavior: PauseBehavior
  /** `[analytics].custom_events` in ruken.toml. `track` drops every other name. */
  readonly disclosedEvents: readonly string[]
  /** Test builds only: exact https origins also trusted to send the welcome. Passed to `Ruken.init` as is. */
  readonly testHostOrigins?: readonly string[]
}

/** The width, in CSS pixels of the game frame, the host keeps for its own controls on each side. */
export interface HostReserved {
  readonly left: number
  readonly right: number
}

export type AnalyticsProps = Record<string, string | number | boolean>

/** Everything a game may ask of, or hear from, its host (M1.4 spec §3.2). */
export interface HostingService {
  /** Which adapter is running. */
  readonly kind: 'ruken' | 'web'
  /** True only inside a Ruken frame that completed the handshake. */
  readonly hosted: boolean
  readonly granted: ReadonlySet<Capability>
  readonly player: { readonly id: string; readonly displayName: string }
  readonly locale: string

  /** Succeeds once the host sends `session.ready` (R-04); at once on the web. Render nothing before it. */
  readonly ready: Effect.Effect<void>

  /** The player's saves: Ruken's synchronous Storage-like object, filled from the welcome snapshot. */
  readonly saves: Effect.Effect<SavesStorage, CapabilityDenied>
  /** Waits until every save write has reached the host. */
  readonly flushSaves: Effect.Effect<void, CapabilityDenied | HostRequestFailed>
  readonly savesStatus: Effect.Effect<SavesStatus>
  /** This browser's own localStorage, for values that must not follow the player; undefined when blocked. */
  readonly deviceStorage: Storage | undefined

  readonly display: Effect.Effect<DisplayMetricsPayload>
  /** Changes after subscription; read `display` for the current value. */
  readonly displayChanges: Stream.Stream<DisplayMetricsPayload>
  readonly hostReserved: Effect.Effect<HostReserved>
  readonly setFullscreen: (on: boolean) => Effect.Effect<FullscreenRes, HostRequestFailed>
  /** 0..1: multiply the game's own mix by this. */
  readonly audioGain: Effect.Effect<number>
  readonly audioChanges: Stream.Stream<AudioChange>
  readonly lifecycle: Effect.Effect<LifecyclePayload>
  readonly lifecycleChanges: Stream.Stream<LifecyclePayload>

  /** Answers the host's "Open game menu": the handler returns true when the game opened its own menu. */
  readonly setMenuHandler: (handler: () => boolean) => Effect.Effect<void>
  /**
   * Runs `work` when the host closes the game. The host waits for it, but never more
   * than `HOST_EXIT_CAP`. The registration lasts as long as the surrounding scope.
   */
  readonly onExiting: (work: Effect.Effect<void>) => Effect.Effect<void, never, Scope.Scope>
  /** Hands the player back to the host. */
  readonly exit: (reason: 'player' | 'completed') => Effect.Effect<void, HostRequestFailed>

  /** Opens an https link through the host, which asks the player first. */
  readonly openLink: (url: string) => Effect.Effect<LinksOpenRes, CapabilityDenied | HostRequestFailed>
  /** One natural ad break. Without the `ads` grant Ruken answers `{ shown: false, reason: "tier" }`. */
  readonly naturalBreak: Effect.Effect<AdBreakRes, HostRequestFailed>
  /** A disclosed analytics event. Never fails: undisclosed, refused or unconsented events are dropped. */
  readonly track: (name: string, props?: AnalyticsProps) => Effect.Effect<void>
  /** A round began. A second start before an end is dropped. */
  readonly roundStart: Effect.Effect<void>
  /** The open round ended. With no round open it is dropped. */
  readonly roundEnd: (outcome: RoundOutcome) => Effect.Effect<void>
}

/** The `Hosting` service tag. Provide it with `HostingLive`, `RukenHostingLive`, `WebHostingLive` or a testing layer. */
export const Hosting: Context.Tag<HostingService, HostingService> = Context.GenericTag<HostingService>(
  '@mcthaydt/automata-host/Hosting',
)
