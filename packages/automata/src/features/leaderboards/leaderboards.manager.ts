// The game's leaderboards for screens (M5 spec §4.8): `Hosting.leaderboards` (PRODUCT.1) with each answer turned into
// a named state. Ruken owns every board: nothing here keeps scores, so offline is "offline", never a local board.
// Ruken checks a score's range on its side; AF only refuses what the SDK cannot send (a score that is not a whole
// number), as FloorFifty's `scores-hosted` tests expect.

import { Context, Effect } from 'effect'
import { Hosting, type HostingLeaderboards } from '../../shared/host/hosting.ts'
import { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import { type BoardState, boardStateFromError, boardStateFromSubmit } from './board-state.js'

/** What `readBoard` asks for: Ruken's `get` options (`scope` `top` or `around-me`, `limit`). */
export type BoardQuery = NonNullable<Parameters<HostingLeaderboards['get']>[1]>
/** One row of a board, as Ruken gives it; `isMe` marks the player. */
export type BoardEntry = Effect.Effect.Success<ReturnType<HostingLeaderboards['get']>>['entries'][number]

/** A board read for a screen: its rows, or why there are none. */
export type BoardView =
  | { readonly state: 'entries'; readonly entries: readonly BoardEntry[] }
  | { readonly state: 'empty' }
  | { readonly state: 'unavailable' }
  | { readonly state: 'offline' }

/** `Board` is the game's board ids (its ship config's `leaderboards` keys); `string` until a game narrows it. */
export interface Leaderboards<Board extends string = string> {
  /** Sends `score` to `board`. Never fails: the result, also published as `leaderboard.submitted`, is the state. */
  submitScore(board: Board, score: number): Effect.Effect<BoardState>
  /** Reads `board` from the host. Never fails, and never answers from a copy kept here. */
  readBoard(board: Board, query?: BoardQuery): Effect.Effect<BoardView>
  /** The state of the last submit to `board` (`idle` before one). */
  state(board: Board): BoardState
}

export const Leaderboards: Context.Tag<Leaderboards, Leaderboards> = Context.GenericTag<Leaderboards>(
  '@mcthaydt/automata-runtime/Leaderboards',
)

const IDLE: BoardState = { state: 'idle' }

/**
 * Builds the leaderboards service over `Hosting`; each submit's state is published as
 * `leaderboard.submitted`.
 */
export const makeLeaderboards: Effect.Effect<Leaderboards, never, Hosting | PresentationBus> = Effect.gen(
  function* () {
    const hosting = yield* Hosting
    const bus = yield* PresentationBus
    const states = new Map<string, BoardState>()
    const settle = (board: string, state: BoardState): BoardState => {
      states.set(board, state)
      bus.publish('leaderboard.submitted', { board, state })
      return state
    }

    return {
      submitScore: (board, score) =>
        Effect.suspend(() => {
          // A score is a whole number the game computed from sim state (R-80); anything else never reaches the host.
          if (!Number.isInteger(score)) return Effect.succeed(settle(board, { state: 'refused' }))
          settle(board, { state: 'submitting' })
          return hosting.ready.pipe(
            Effect.zipRight(hosting.leaderboards.submit(board, score)),
            Effect.match({ onFailure: boardStateFromError, onSuccess: boardStateFromSubmit }),
            Effect.map((state) => settle(board, state)),
          )
        }),
      readBoard: (board, query) =>
        hosting.ready.pipe(
          Effect.zipRight(hosting.leaderboards.get(board, query)),
          Effect.match({
            onFailure: (error): BoardView => {
              const state = boardStateFromError(error)
              return state.state === 'offline' ? { state: 'offline' } : { state: 'unavailable' }
            },
            onSuccess: ({ entries }): BoardView =>
              entries.length === 0 ? { state: 'empty' } : { state: 'entries', entries },
          }),
        ),
      state: (board) => states.get(board) ?? IDLE,
    }
  },
)
