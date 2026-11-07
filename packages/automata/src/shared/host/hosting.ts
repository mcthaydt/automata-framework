import type { Option, Scope, Stream, Subscribable } from 'effect'
import { Context, Duration, type Effect } from 'effect'
import type { HostError, HostHandshakeFailed } from './errors'
import type {
  AudioChange,
  Capability,
  DisplayMetricsPayload,
  EntitlementsPayload,
  FullscreenRes,
  InputModePayload,
  LeaderboardGetRes,
  LeaderboardQuery,
  LeaderboardSubmitMeta,
  LeaderboardSubmitRes,
  LifecyclePayload,
  PauseBehavior,
  RoundOutcome,
  SavesChangedPayload,
  SavesFlushRes,
  SavesStatus,
} from './index'

/** What the game asks of its host. The game passes these by hand; content does not list them yet. */
export interface HostingOptions {
  /** The game config's `game.id`; a host that knows the game (Ruken) checks it. */
  readonly gameId: string
  /** The capabilities the game asks the host for (`wants` in the hello). */
  readonly wants: readonly Capability[]
  /** Fixed for the game's whole life (Ruken's answer 7 in docs/archive/spikes/s6-ruken-stub.md). */
  readonly pauseBehavior: PauseBehavior
  /**
   * The game config's `analytics.custom_events`. When given, `track` drops every
   * other name before it reaches the SDK (FloorFifty `ruken/host.ts` `track`).
   */
  readonly disclosedEvents?: readonly string[]
  /**
   * Ruken adapter, test builds only: exact https origins also trusted to send the welcome. Passed to `Ruken.init`
   * as is; other adapters ignore it.
   */
  readonly testHostOrigins?: readonly string[]
}

/**
 * The properties of one analytics event: flat names to strings, numbers or booleans.
 */
export type AnalyticsProps = Record<string, string | number | boolean>

/** The player's saves. Each call relays the SDK's error as a `HostError`; none falls back. */
export interface HostingSaves {
  get(key: string): Effect.Effect<string | null, HostError>
  set(key: string, value: string): Effect.Effect<void, HostError>
  remove(key: string): Effect.Effect<void, HostError>
  readonly flush: Effect.Effect<SavesFlushRes, HostError>
  /** Every key the session holds, sorted by code unit. Fails `CANCELLED` once Hosting has shut down. */
  readonly keys: Effect.Effect<readonly string[], HostError>
  /**
   * Another device's write, or the host's conflict choice, reached this session (`SavesApi.on('changed')`). No current value: only changes. Ends when Hosting shuts down.
   */
  readonly changed: Stream.Stream<SavesChangedPayload>
}

/**
 * The host's leaderboards (Ruken's `LeaderboardsApi`). Needs the `leaderboards` grant.
 * Each call relays the SDK's answer or error as a `HostError`: without the grant and standalone it fails
 * `UNSUPPORTED`, offline it fails with the host's code. None keeps a local board instead.
 */
export interface HostingLeaderboards {
  /** Submits `score` to `board` (a Ruken slug); `meta` is passed to the host as is. */
  submit(
    board: string,
    score: number,
    meta?: LeaderboardSubmitMeta,
  ): Effect.Effect<LeaderboardSubmitRes, HostError>
  /**
   * Reads `board` with the SDK's options (`scope` `top` or `around-me`, `limit`). Ruken's host now answers with the
   * player's own entry only, or none, whatever the options (the SDK marks `get` deprecated at RukenApp d0fa2fe, since
   * Ruken added achievements); the call and its answer's shape are unchanged.
   */
  get(board: string, query?: LeaderboardQuery): Effect.Effect<LeaderboardGetRes, HostError>
}

/**
 * Everything a game may ask of, or hear from, its host: the `Hosting` contract,
 * which each target's adapter implements.
 */
export interface Hosting {
  /**
   * Which session this is: 'ruken' when Ruken hosts it; 'standalone' when the Ruken adapter got the SDK's
   * standalone session; 'web' for the web adapter of an `itch` or `web` build; 'tauri' for the
   * desktop adapter.
   */
  readonly kind: 'ruken' | 'standalone' | 'web' | 'tauri'
  /**
   * The host's name for UI: 'Ruken', 'itch.io', 'this page', or the game's title on the desktop.
   */
  readonly hostName: string
  /** Some when the page is inside a frame but the SDK fell back to standalone. */
  readonly handshake: { readonly fellBack: Option.Option<HostHandshakeFailed> }
  readonly player: { readonly id: string; readonly displayName: string }
  readonly locale: string
  readonly granted: ReadonlySet<Capability>
  /** Resolves on `session.ready` (at once standalone). No gameplay renders before it (R-04). */
  readonly ready: Effect.Effect<void, HostError>

  // Observed host state: the current value plus its changes.
  readonly lifecycle: Subscribable.Subscribable<LifecyclePayload>
  readonly input: Subscribable.Subscribable<InputModePayload>
  readonly display: Subscribable.Subscribable<DisplayMetricsPayload>
  readonly audio: Subscribable.Subscribable<AudioChange>
  readonly entitlements: Subscribable.Subscribable<EntitlementsPayload>
  readonly savesStatus: Subscribable.Subscribable<SavesStatus>

  readonly saves: HostingSaves
  readonly leaderboards: HostingLeaderboards
  /** `support` says what the device allows (for example `ios-home-screen`). */
  setFullscreen(on: boolean): Effect.Effect<FullscreenRes, HostError>
  readonly round: {
    /** A round began. A second start before an end is dropped. */
    readonly start: Effect.Effect<void>
    /** The open round ended. With no round open it is dropped. */
    end(outcome?: RoundOutcome): Effect.Effect<void>
    /**
     * One item per round that ended, with its outcome, from the moment the stream
     * is read (nothing is replayed). A dropped end gives none. Ends when Hosting
     * shuts down. The `round-end` autosave trigger reads this.
     */
    readonly ended: Stream.Stream<RoundOutcome | undefined>
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
   * host waits for it, but AF cuts everything off at `HOST_EXIT_CAP` (1 s),
   * inside Ruken's 1.5 s grace. Handlers run one after another in registration
   * order and the host save flush runs after the last, so a write a handler
   * makes is flushed. All of them share the one cap: a handler that never
   * returns costs the handlers after it and the flush.
   */
  onExiting(handler: Effect.Effect<void>): Effect.Effect<void, never, Scope.Scope>
}

/**
 * How long the game may hold the host's close (a 1 s cap). Ruken's own grace is 1.5 s
 * (`sdk-host/src/bridge/defaults.ts` `EXIT_GRACE_MS`), so the game always answers before the host gives up on it;
 * every adapter cuts the `onExiting` handlers and the flush off at this cap.
 */
export const HOST_EXIT_CAP: Duration.Duration = Duration.seconds(1)

/** The `Hosting` service tag. */
export const Hosting: Context.Tag<Hosting, Hosting> = Context.GenericTag<Hosting>(
  '@mcthaydt/automata-host/Hosting',
)
