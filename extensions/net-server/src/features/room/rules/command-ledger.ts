/**
 * Answers each correlated request exactly once.
 *
 * A client that loses its connection in the middle of a request cannot know whether the room acted, so it resends
 * it with the same request id. The ledger remembers the answer it gave each id and replays it, so a resent "ready"
 * never acts twice. History is bounded per session, oldest first out, so a client cannot make the room remember an
 * unbounded number of ids.
 *
 * No I/O: the room sends the answer (net's `answer` message); this only decides what it is.
 */

import { reqIdSchema } from '@automata/net'
import { type ServerError, toServerError } from './room-errors'

/** Answers remembered per session. */
export const COMMAND_HISTORY = 64

/** The answer to one request. */
export type CommandResult =
  | { readonly req: string; readonly ok: true }
  | { readonly req: string; readonly ok: false; readonly error: ServerError }

/** The answer to one request, and whether it came from history. */
export interface LedgerAnswer {
  readonly result: CommandResult
  /** True when the request did not run because this id was answered before. */
  readonly replayed: boolean
}

/**
 * The request id (`req`) a raw message carries, if any.
 *
 * Read before the rest of the message is validated, because even a malformed request has to be answered, and the
 * answer is addressed by this id. Runs on raw client data, so it must never throw: it reads only the message's own
 * data property, which runs no code, and takes it only when net's `reqIdSchema` does, which checks the type before
 * anything else and never converts a value to a string.
 */
export function requestIdOf(message: unknown): string | undefined {
  if (typeof message !== 'object' || message === null) return undefined
  const property = Object.getOwnPropertyDescriptor(message, 'req')
  if (property === undefined || !('value' in property)) return undefined
  const parsed = reqIdSchema.safeParse(property.value)
  return parsed.success ? parsed.data : undefined
}

export class CommandLedger {
  /** Answers per session, oldest first: a `Map` iterates in insertion order. */
  private readonly answers = new Map<string, Map<string, CommandResult>>()
  private readonly capacity: number

  constructor(capacity: number = COMMAND_HISTORY) {
    this.capacity = capacity
  }

  /**
   * Runs `run` for a request id this session has not sent before, or replays the stored answer for one it has.
   * `run` refuses by throwing; the throw becomes an `ok: false` answer and is remembered like any other, so a resent
   * refusal is refused again without running a second time.
   */
  answer(session: string, req: string, run: () => void): LedgerAnswer {
    const history = this.historyOf(session)
    const stored = history.get(req)
    if (stored !== undefined) return { result: stored, replayed: true }

    let result: CommandResult
    try {
      run()
      result = { req, ok: true }
    } catch (error) {
      result = { req, ok: false, error: toServerError(error) }
    }

    history.set(req, result)
    this.trim(history)
    return { result, replayed: false }
  }

  /** Drops a session's history, for a seat that has left for good. */
  forget(session: string): void {
    this.answers.delete(session)
  }

  private historyOf(session: string): Map<string, CommandResult> {
    let history = this.answers.get(session)
    if (history === undefined) {
      history = new Map()
      this.answers.set(session, history)
    }
    return history
  }

  /** Evicts the oldest answers until the history fits its capacity. */
  private trim(history: Map<string, CommandResult>): void {
    while (history.size > this.capacity) {
      const oldest = history.keys().next().value
      if (oldest === undefined) return
      history.delete(oldest)
    }
  }
}
