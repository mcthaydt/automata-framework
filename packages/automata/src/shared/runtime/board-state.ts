// What a leaderboard call ended as, for a screen to show. Every host answer maps to one named
// state; none of them keeps a local board instead (host authority).

import type { HostRefusal } from '../host/errors.ts'
import type { LeaderboardSubmitRes } from '../host/leaderboards.schema.ts'

/** The host's answer to a submit (Ruken's `LeaderboardSubmitRes`), as `Hosting.leaderboards` relays it. */
export type SubmitAnswer = LeaderboardSubmitRes

/** The state of a board after the game's last submit to it. */
export type BoardState =
  | { readonly state: 'idle' }
  | { readonly state: 'submitting' }
  | { readonly state: 'accepted'; readonly personalBest: number; readonly rank?: number }
  /** The host did not take the score: `accepted: false`, or a score it rejects (`INVALID_PAYLOAD`). */
  | { readonly state: 'refused' }
  /** No `leaderboards` grant, standalone, or any host failure that is not the network. */
  | { readonly state: 'unavailable' }
  | { readonly state: 'offline' }

export function boardStateFromSubmit(res: SubmitAnswer): BoardState {
  if (!res.accepted) return { state: 'refused' }
  return res.rank === undefined
    ? { state: 'accepted', personalBest: res.personalBest }
    : { state: 'accepted', personalBest: res.personalBest, rank: res.rank }
}

/** `OFFLINE` and `TIMEOUT` are the network; `INVALID_PAYLOAD` is the score; everything else leaves no board here. */
export function boardStateFromError(
  error: Pick<HostRefusal, 'code'>,
): Extract<BoardState, { state: 'refused' | 'unavailable' | 'offline' }> {
  switch (error.code) {
    case 'OFFLINE':
    case 'TIMEOUT':
      return { state: 'offline' }
    case 'INVALID_PAYLOAD':
      return { state: 'refused' }
    default:
      return { state: 'unavailable' }
  }
}
