import { Data } from 'effect'
import type { YieldableError } from 'effect/Cause'
import type { ErrorCode } from './error-code.schema'

/*
 * The typed failures of `Hosting`.
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

interface HostErrorFields {
  /** The contract's code; the Ruken adapter relays Ruken's unchanged. */
  readonly code: ErrorCode
  /** Whether a retry may succeed (Ruken's flag, relayed unchanged). Retry only when true, with Effect's `Schedule`. */
  readonly retryable: boolean
  /** The protocol request or `Hosting` call that failed, for example `saves.set`. */
  readonly operation: string
  readonly cause?: unknown
}
const HostErrorBase: TaggedErrorClass<'HostError', HostErrorFields> = Data.TaggedError('HostError')
/** Any failure after the handshake. A request that fails never falls back to another path. */
export class HostError extends HostErrorBase {}

interface HostHandshakeFailedFields {
  /** The Ruken SDK does not say whether it timed out or rejected a welcome. */
  readonly reason: 'no-welcome'
}
const HostHandshakeFailedBase: TaggedErrorClass<'HostHandshakeFailed', HostHandshakeFailedFields> =
  Data.TaggedError('HostHandshakeFailed')
/**
 * The page is inside a frame, but the SDK got no usable welcome and fell back
 * to its standalone session. Not fatal: reported on `Hosting.handshake.fellBack`
 * and logged once.
 */
export class HostHandshakeFailed extends HostHandshakeFailedBase {}
