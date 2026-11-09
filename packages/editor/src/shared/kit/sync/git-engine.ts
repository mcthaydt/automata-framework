import type { AskReason } from './merge-drivers'

// What the sync loop needs of git. The app's engine (isomorphic-git over the app's folder, with the platform's HTTP
// client) implements it; the loop's tests use a fake. Every call that reaches GitHub says so by throwing
// `OfflineError` when the network is not there, so the loop can say "no internet" and try again later.

/** The network is not there (or GitHub did not answer): not a failure of the game's files. */
export class OfflineError extends Error {
  constructor(message = 'No internet.') {
    super(message)
    this.name = 'OfflineError'
  }
}

/**
 * The engine can't go on and says why in words: a game too big for the web, GitHub asking for a wait. The loop shows
 * "Saved on this device. {words}" and pulls no more until `until` (when given) or until the person acts.
 */
export class SyncStopped extends Error {
  constructor(
    readonly words: string,
    /** When the loop may try again, in the clock's milliseconds; without it, when the person acts. */
    readonly until?: number,
  ) {
    super(words)
    this.name = 'SyncStopped'
  }
}

/** A file that changed on both sides and needs the person's choice. */
export interface MergeAsk {
  readonly path: string
  readonly reason: AskReason
  readonly where?: string
  readonly keepBothPath?: string
}

/** What bringing GitHub's `main` into the game changed. */
export interface PullOutcome {
  /** Files whose new contents are now in the game's folder: the editors reload them. */
  readonly changed: readonly string[]
  /** Files that could not merge. They are left as they were here until the person chooses. */
  readonly asks: readonly MergeAsk[]
  /** Generated files (a level's TOML) that were edited on GitHub; the app makes them again from the level. */
  readonly generated: readonly string[]
}

export type PushResult = 'pushed' | 'offline' | 'rejected'

/** What the person chose for a file that changed here and on GitHub. */
export type Choice = 'mine' | 'theirs' | 'both'

/** The files an engine wrote while carrying out a choice: the editors reload them. */
export interface Resolved {
  readonly changed: readonly string[]
}

export interface GitEngine {
  /** Whether GitHub's `main` has commits the game does not. */
  fetchMain(): Promise<'unchanged' | 'changed'>
  /** Brings the fetched `main` into the game, merging files by their kind. */
  mergeMain(): Promise<PullOutcome>
  /** One commit of everything changed in the folder, or `undefined` when nothing changed. */
  commitAll(message: string): Promise<string | undefined>
  /** Whether there are commits that are not on GitHub yet (from a push that did not get through, or before a quit). */
  hasUnpushed(): Promise<boolean>
  /** Pushes without force. */
  push(): Promise<PushResult>
  /** The files waiting for the person's choice, kept across restarts. An engine that cannot ask has none. */
  conflicts?(): Promise<readonly MergeAsk[]>
  /**
   * Carries out a choice for one waiting file. `mine` leaves it as it is here and lets the next push send it over
   * GitHub's; `theirs` takes GitHub's; `both` keeps this one and saves GitHub's beside it. It fetches before it writes, so
   * a lost network throws `OfflineError` and the file keeps waiting.
   */
  resolve?(path: string, choice: Choice): Promise<Resolved>
}
