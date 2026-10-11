import { RukenError } from '@ruken/sdk'
import { Data } from 'effect'
import type { YieldableError } from 'effect/Cause'

/*
 * The typed failures of `Hosting` (M1 shared contracts §1.2).
 *
 * Both are `Data.TaggedError`s, so callers handle them by tag
 * (`Effect.catchTag('HostError', …)`). The repo builds with
 * `isolatedDeclarations`, which forbids `class X extends Data.TaggedError(…)`
 * directly, so each base constructor gets an explicit type first and the
 * exported class extends that.
 */

type TaggedErrorClass<Tag extends string, Fields> = new (
  fields: Fields,
) => YieldableError & { readonly _tag: Tag } & Readonly<Fields>

/** Ruken's error codes (`@ruken/protocol` `ERROR_CODES`), as the SDK's `RukenError` carries them. */
export type ErrorCode = RukenError['code']

interface HostErrorFields {
  /** Ruken's code, unchanged. */
  readonly code: ErrorCode
  /** Ruken's flag, unchanged. Retry only when true, with Effect's `Schedule`. */
  readonly retryable: boolean
  /** The protocol request or `Hosting` call that failed, for example `saves.set`. */
  readonly operation: string
  readonly cause?: unknown
}
const HostErrorBase: TaggedErrorClass<'HostError', HostErrorFields> = Data.TaggedError('HostError')
/** Any failure after the handshake. A request that fails never falls back to another path. */
export class HostError extends HostErrorBase {}

interface HostHandshakeFailedFields {
  /** The SDK does not say whether it timed out or rejected a welcome. */
  readonly reason: 'no-welcome'
}
const HostHandshakeFailedBase: TaggedErrorClass<'HostHandshakeFailed', HostHandshakeFailedFields> =
  Data.TaggedError('HostHandshakeFailed')
/**
 * The page is inside a frame, but the SDK got no usable welcome and fell back
 * to its standalone session. Not fatal: reported on `Hosting.handshake.fellBack`
 * and logged once (shared contracts §1.2).
 */
export class HostHandshakeFailed extends HostHandshakeFailedBase {}

/**
 * Turns whatever the SDK threw or rejected with into a `HostError`.
 * - A `RukenError` keeps its code and retryable flag.
 * - A `QuotaExceededError` is what Ruken's save map throws for a save over a
 *   limit (`sdk/src/save-map.ts`); it becomes `QUOTA_EXCEEDED`, which Ruken
 *   marks not retryable.
 * - Anything else (a closed port, a bug) becomes `INTERNAL`, which Ruken marks retryable.
 */
export function toHostError(operation: string, cause: unknown): HostError {
  if (cause instanceof RukenError) {
    return new HostError({ code: cause.code, retryable: cause.retryable, operation, cause })
  }
  if (cause instanceof DOMException && cause.name === 'QuotaExceededError') {
    return new HostError({ code: 'QUOTA_EXCEEDED', retryable: false, operation, cause })
  }
  return new HostError({ code: 'INTERNAL', retryable: true, operation, cause })
}
