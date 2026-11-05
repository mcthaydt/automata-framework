// The LeaderboardPanel's contract (M5 spec §7). The view is the runtime's `BoardView` with `loading` added, typed here
// because ui does not depend on the runtime; the runtime's value fits it as it is.

/** One row of a board, as the host gives it; `isMe` marks the player. */
export interface LeaderboardEntryView {
  readonly rank: number
  readonly displayName: string
  readonly score: number
  readonly isMe: boolean
}

/** What the panel shows: the rows, or why there are none. */
export type LeaderboardView =
  | { readonly state: 'loading' }
  | { readonly state: 'entries'; readonly entries: readonly LeaderboardEntryView[] }
  | { readonly state: 'empty' }
  | { readonly state: 'unavailable' }
  | { readonly state: 'offline' }

/** Every word the panel shows, in the game's language. */
export interface LeaderboardCopy {
  readonly title: string
  readonly loading: string
  readonly empty: string
  /** `UNSUPPORTED`: no grant, or standalone ("Scores aren't available here"). */
  readonly unavailable: string
  /** `OFFLINE` ("You're offline"). */
  readonly offline: string
  /** Said beside the player's own row. */
  readonly you: string
  /** "+N more", for the rows below the fold. */
  readonly more: (count: number) => string
}
