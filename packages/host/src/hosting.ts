import type {
  AudioChange,
  Capability,
  DisplayMetricsPayload,
  EntitlementsPayload,
  FullscreenRes,
  InputModePayload,
  LifecyclePayload,
  PauseBehavior,
  RoundOutcome,
  SavesFlushRes,
  SavesStatus,
} from '@ruken/sdk'
import type { Effect, Option, Scope } from 'effect'
import { Context } from 'effect'
import type { HostError, HostHandshakeFailed } from './errors'
import type { Observed } from './observed'

/** What the game asks of its host. In M1 the game passes these by hand; later they come from content. */
export interface HostingOptions {
  /** `[game].id` in ruken.toml; the host checks it. */
  readonly gameId: string
  /** The capabilities the game asks the host for (`wants` in the hello). */
  readonly wants: readonly Capability[]
  /** Fixed for the game's whole life (Ruken's answer 7 in docs/spikes/s6-ruken-stub.md). */
  readonly pauseBehavior: PauseBehavior
  /**
   * `[analytics].custom_events` in ruken.toml. When given, `track` drops every
   * other name before it reaches the SDK (FloorFifty `ruken/host.ts` `track`).
   */
  readonly disclosedEvents?: readonly string[]
  /** Test builds only: exact https origins also trusted to send the welcome. Passed to `Ruken.init` as is. */
  readonly testHostOrigins?: readonly string[]
}

export type AnalyticsProps = Record<string, string | number | boolean>

/** The player's saves (shared contracts §1.1). Each call relays the SDK's error as a `HostError`; none falls back. */
export interface HostingSaves {
  get(key: string): Effect.Effect<string | null, HostError>
  set(key: string, value: string): Effect.Effect<void, HostError>
  remove(key: string): Effect.Effect<void, HostError>
  readonly flush: Effect.Effect<SavesFlushRes, HostError>
}

/**
 * Everything a game may ask of, or hear from, its host: the `Hosting` contract
 * of the M1 shared contracts spec §1, implemented by the host lane.
 */
export interface Hosting {
  /**
   * Which session this is: 'ruken' when Ruken hosts it; 'standalone' when the Ruken adapter got the SDK's
   * standalone session; 'web' for the web adapter of an `itch` or `web` build (PUB spec §3).
   */
  readonly kind: 'ruken' | 'standalone' | 'web'
  /** The host's name for UI, such as "Back to …": 'Ruken', 'itch.io' or 'this page' (PUB spec §3). */
  readonly hostName: string
  /** Some when the page is inside a frame but the SDK fell back to standalone (shared contracts §1.2). */
  readonly handshake: { readonly fellBack: Option.Option<HostHandshakeFailed> }
  readonly player: { readonly id: string; readonly displayName: string }
  readonly locale: string
  readonly granted: ReadonlySet<Capability>
  /** Resolves on `session.ready` (at once standalone). No gameplay renders before it (R-04). */
  readonly ready: Effect.Effect<void, HostError>

  // Observed host state: the current value plus its changes (`changes(hosting.x)` gives a Stream).
  readonly lifecycle: Observed<LifecyclePayload>
  readonly input: Observed<InputModePayload>
  readonly display: Observed<DisplayMetricsPayload>
  readonly audio: Observed<AudioChange>
  readonly entitlements: Observed<EntitlementsPayload>
  readonly savesStatus: Observed<SavesStatus>

  readonly saves: HostingSaves
  /** Ruken's `FullscreenRes`: `support` says what the device allows (for example `ios-home-screen`). */
  setFullscreen(on: boolean): Effect.Effect<FullscreenRes, HostError>
  readonly round: {
    /** A round began. A second start before an end is dropped. */
    readonly start: Effect.Effect<void>
    /** The open round ended. With no round open it is dropped. */
    end(outcome?: RoundOutcome): Effect.Effect<void>
  }
  /** A disclosed analytics event. Never fails: undisclosed, unconsented or refused events are dropped. */
  track(event: string, props?: AnalyticsProps): Effect.Effect<void>
  /** Hands the player back to the host. Standalone it does nothing. */
  exit(reason?: 'player' | 'completed'): Effect.Effect<void, HostError>
  /**
   * Answers the host's "Open game menu" while the scope is open: the handler
   * returns true when the game opened its own menu. With no handler the host
   * keeps its own drawer.
   */
  onMenuRequest(handler: () => boolean): Effect.Effect<void, never, Scope.Scope>
  /**
   * Runs `handler` when the host closes the game, while the scope is open. The
   * host waits for it, but AF cuts it off at `HOST_EXIT_CAP` (1 s), inside
   * Ruken's 1.5 s grace.
   */
  onExiting(handler: Effect.Effect<void>): Effect.Effect<void, never, Scope.Scope>
}

/** The `Hosting` service tag. */
export const Hosting: Context.Tag<Hosting, Hosting> = Context.GenericTag<Hosting>(
  '@mcthaydt/automata-host/Hosting',
)
