// What the game asks of its host, in plain TypeScript: promises that answer with a `HostResult`,
// observed state as `Subscribable`, events as `Listenable`, and `dispose()` where Effect had a `Scope`.
// Temporary name: task 5.4 deletes `hosting.ts` (the Effect version) and this file becomes `hosting.ts`.
import type { Listenable, Subscribable } from '../lib/subscribable'
import type { HostingOptions } from './hosting'
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
  RoundOutcome,
  SavesChangedPayload,
  SavesFlushRes,
  SavesStatus,
} from './index'
import type { HostHandshakeFailed, HostResult } from './plain-errors'

/** How long the game may hold the host's close, in milliseconds (Ruken's own grace is 1.5 s, so we answer first). */
export const HOST_EXIT_CAP_MS = 1000

/** The player's saves. Each call relays the host's answer or refusal; none falls back to other storage. */
export interface HostingSaves {
  get(key: string): Promise<HostResult<string | null>>
  set(key: string, value: string): Promise<HostResult<void>>
  remove(key: string): Promise<HostResult<void>>
  flush(): Promise<HostResult<SavesFlushRes>>
  /** Every key the session holds, sorted by code unit. Refused `CANCELLED` once Hosting is disposed. */
  keys(): Promise<HostResult<readonly string[]>>
  /** Another device's write, or the host's conflict choice, reached this session. Only changes, no current value. */
  readonly changed: Listenable<SavesChangedPayload>
}

/** The host's leaderboards. Needs the `leaderboards` grant; without it a call is refused `UNSUPPORTED`. */
export interface HostingLeaderboards {
  submit(
    board: string,
    score: number,
    meta?: LeaderboardSubmitMeta,
  ): Promise<HostResult<LeaderboardSubmitRes>>
  get(board: string, query?: LeaderboardQuery): Promise<HostResult<LeaderboardGetRes>>
}

/** Everything a game may ask of, or hear from, its host. Every target's adapter builds one of these. */
export interface Hosting {
  /** 'ruken' when Ruken hosts it; 'standalone' for the Ruken adapter's standalone session; 'web'; 'tauri'. */
  readonly kind: 'ruken' | 'standalone' | 'web' | 'tauri'
  /** The host's name for UI: 'Ruken', 'itch.io', 'this page', or the game's title on the desktop. */
  readonly hostName: string
  /** Set when the page is inside a frame but the SDK fell back to standalone. */
  readonly handshake: { readonly fellBack: HostHandshakeFailed | null }
  readonly player: { readonly id: string; readonly displayName: string }
  readonly locale: string
  readonly granted: ReadonlySet<Capability>
  /** Answers on `session.ready` (at once standalone). No gameplay renders before it (R-04). Never rejects. */
  readonly ready: Promise<HostResult<void>>

  // Observed host state: the current value plus its changes. Disposing Hosting stops every subscription.
  readonly lifecycle: Subscribable<LifecyclePayload>
  readonly input: Subscribable<InputModePayload>
  readonly display: Subscribable<DisplayMetricsPayload>
  readonly audio: Subscribable<AudioChange>
  readonly entitlements: Subscribable<EntitlementsPayload>
  readonly savesStatus: Subscribable<SavesStatus>

  readonly saves: HostingSaves
  readonly leaderboards: HostingLeaderboards
  /** `support` in the answer says what the device allows (for example `ios-home-screen`). */
  setFullscreen(on: boolean): Promise<HostResult<FullscreenRes>>
  readonly round: {
    /** A round began. A second start before an end is dropped. */
    start(): void
    /** The open round ended. With no round open it is dropped. */
    end(outcome?: RoundOutcome): void
    /** One event per round that ended, with its outcome, from the moment of subscribing. A dropped end gives none. */
    readonly ended: Listenable<RoundOutcome | undefined>
  }
  /** A disclosed analytics event. Never fails: undisclosed, unconsented or refused events are dropped. */
  track(event: string, props?: Record<string, string | number | boolean>): void
  /** Hands the player back to the host. Standalone it is refused `UNSUPPORTED`. */
  exit(reason?: 'player' | 'completed'): Promise<HostResult<void>>
  /**
   * Answers the host's "Open game menu": the handler returns true when the game opened its own menu. Returns the
   * function that takes the handler back. With no handler the host keeps its own drawer.
   */
  onMenuRequest(handler: () => boolean): () => void
  /**
   * Runs `handler` when the host closes the game. The host waits for it, but AF cuts everything off at
   * `HOST_EXIT_CAP_MS`. Handlers run one after another in registration order and the host save flush runs after the
   * last, so a write a handler makes is flushed. Returns the function that takes the handler back.
   */
  onExiting(handler: () => void | Promise<void>): () => void
  /** Shuts Hosting down: later calls are refused `CANCELLED`, every subscription stops, the session is released. */
  dispose(): void
}
