// How the host says no, in plain TypeScript. A refusal is an ordinary answer, so a host call
// returns it as a value (`{ ok: false, reason }`) and the caller must look; nothing throws and nothing falls back.
// Temporary name: task 5.4 deletes `errors.ts` (the Effect version) and this file becomes `errors.ts`.
import { type Result, refused } from '../lib/result'
import type { ErrorCode } from './error-code.schema'

export interface HostRefusal {
  /** The contract's code; the Ruken adapter relays Ruken's unchanged. */
  readonly code: ErrorCode
  /** Whether a retry may succeed (Ruken's flag, relayed unchanged). */
  readonly retryable: boolean
  /** The protocol request or `Hosting` call that was refused, for example `saves.set`. */
  readonly operation: string
  readonly cause?: unknown
}

/** What a host call answers: the value, or the host's refusal. */
export type HostResult<T> = Result<T, HostRefusal>

/**
 * The page is inside a frame, but the SDK got no usable welcome and fell back to its standalone session. Not fatal:
 * reported on `Hosting.handshake.fellBack` and logged once.
 */
export interface HostHandshakeFailed {
  /** The Ruken SDK does not say whether it timed out or rejected a welcome. */
  readonly reason: 'no-welcome'
}

/** A refused host call, ready to return. */
export function refuse(
  code: ErrorCode,
  retryable: boolean,
  operation: string,
  cause?: unknown,
): { readonly ok: false; readonly reason: HostRefusal } {
  return refused(cause === undefined ? { code, retryable, operation } : { code, retryable, operation, cause })
}
