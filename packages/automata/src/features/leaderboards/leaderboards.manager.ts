// The game's leaderboards for screens: `Hosting.leaderboards` with each answer turned into
// a named state. Ruken owns every board: nothing here keeps scores, so offline is "offline", never a local board.
// Ruken checks a score's range on its side; AF only refuses what the SDK cannot send (a score that is not a whole
// number).

import type { HostRefusal } from '../../shared/host/errors.ts'
import type { Hosting, HostingLeaderboards } from '../../shared/host/hosting.ts'
import type { Result } from '../../shared/lib/result.ts'
import {
  type BoardState,
  boardStateFromError,
  boardStateFromSubmit,
} from '../../shared/runtime/board-state.js'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'

/** What `readBoard` asks for: Ruken's `get` options (`scope` `top` or `around-me`, `limit`). */
export type BoardQuery = NonNullable<Parameters<HostingLeaderboards['get']>[1]>
/** One row of a board, as Ruken gives it; `isMe` marks the player. */
export type BoardEntry = Extract<
  Awaited<ReturnType<HostingLeaderboards['get']>>,
  { ok: true }
>['value']['entries'][number]

/** A board read for a screen: its rows, or why there are none. */
export type BoardView =
  | { readonly state: 'entries'; readonly entries: readonly BoardEntry[] }
  | { readonly state: 'empty' }
  | { readonly state: 'unavailable' }
  | { readonly state: 'offline' }

/** `Board` is the game's board ids (its ship config's `leaderboards` keys); `string` until a game narrows it. */
export interface Leaderboards<Board extends string = string> {
  /** Sends `score` to `board`. Never rejects: the result, also published as `leaderboard.submitted`, is the state. */
  submitScore(board: Board, score: number): Promise<BoardState>
  /** Reads `board` from the host. Never rejects, and never answers from a copy kept here. */
  readBoard(board: Board, query?: BoardQuery): Promise<BoardView>
  /** The state of the last submit to `board` (`idle` before one). */
  state(board: Board): BoardState
}

const IDLE: BoardState = { state: 'idle' }

/** The host's answer once `ready` has answered: a refused ready is the call's refusal. */
async function afterReady<A>(
  ready: Promise<Result<void, HostRefusal>>,
  call: () => Promise<Result<A, HostRefusal>>,
): Promise<Result<A, HostRefusal>> {
  const isReady = await ready
  return isReady.ok ? call() : isReady
}

/**
 * Builds the leaderboards service over `Hosting`; each submit's state is published as
 * `leaderboard.submitted`.
 */
export function createLeaderboards(
  hosting: Pick<Hosting, 'ready' | 'leaderboards'>,
  bus: PresentationBus,
): Leaderboards {
  const states = new Map<string, BoardState>()
  const settle = (board: string, state: BoardState): BoardState => {
    states.set(board, state)
    bus.publish('leaderboard.submitted', { board, state })
    return state
  }

  return {
    async submitScore(board, score) {
      // A score is a whole number the game computed from sim state (R-80); anything else never reaches the host.
      if (!Number.isInteger(score)) return settle(board, { state: 'refused' })
      settle(board, { state: 'submitting' })
      const answer = await afterReady(hosting.ready, () => hosting.leaderboards.submit(board, score))
      return settle(
        board,
        answer.ok ? boardStateFromSubmit(answer.value) : boardStateFromError(answer.reason),
      )
    },
    async readBoard(board, query) {
      const answer = await afterReady(hosting.ready, () => hosting.leaderboards.get(board, query))
      if (!answer.ok) {
        const state = boardStateFromError(answer.reason)
        return state.state === 'offline' ? { state: 'offline' } : { state: 'unavailable' }
      }
      return answer.value.entries.length === 0
        ? { state: 'empty' }
        : { state: 'entries', entries: answer.value.entries }
    },
    state: (board) => states.get(board) ?? IDLE,
  }
}
