import type { Capability } from '@ruken/sdk'
import { RukenError } from '@ruken/sdk'
import { Data } from 'effect'
import type { YieldableError } from 'effect/Cause'

/*
 * The typed failures of the `Hosting` service (M1.4 spec §3.3).
 *
 * Each error is a `Data.TaggedError`, so callers can handle it by tag
 * (`Effect.catchTag('CapabilityDenied', …)`). The repo builds with
 * `isolatedDeclarations`, which forbids `class X extends Data.TaggedError(…)`
 * directly, so each base constructor is first given an explicit type and the
 * exported class extends that.
 */

type TaggedErrorClass<Tag extends string, Fields> = new (
  fields: Fields,
) => YieldableError & { readonly _tag: Tag } & Readonly<Fields>

interface HostHandshakeFailedFields {
  /** What `Ruken.init` threw, or a note that the frame never welcomed the game. */
  readonly cause: unknown
}
const HostHandshakeFailedBase: TaggedErrorClass<'HostHandshakeFailed', HostHandshakeFailedFields> =
  Data.TaggedError('HostHandshakeFailed')
/**
 * The game is inside a frame, but no Ruken host completed the handshake. Boot
 * shows an error state; it never switches to the standalone web adapter.
 */
export class HostHandshakeFailed extends HostHandshakeFailedBase {}

interface CapabilityDeniedFields {
  readonly capability: Capability
}
const CapabilityDeniedBase: TaggedErrorClass<'CapabilityDenied', CapabilityDeniedFields> =
  Data.TaggedError('CapabilityDenied')
/** The host did not grant the capability this call needs, or answered DENIED. Nothing falls back. */
export class CapabilityDenied extends CapabilityDeniedBase {}

interface HostRequestFailedFields {
  /** The protocol request, for example `saves.flush`. */
  readonly operation: string
  /** Ruken's error code, verbatim (`TIMEOUT`, `RATE_LIMITED`, `NOT_READY`, …). */
  readonly code: RukenError['code']
  readonly retryable: boolean
}
const HostRequestFailedBase: TaggedErrorClass<'HostRequestFailed', HostRequestFailedFields> =
  Data.TaggedError('HostRequestFailed')
/** Any other failure of a host request. */
export class HostRequestFailed extends HostRequestFailedBase {}

export type HostError = CapabilityDenied | HostRequestFailed

/**
 * Turns whatever an SDK promise rejected with into a typed error.
 * DENIED names the capability the call needed; every other Ruken code is kept
 * as is. A non-Ruken throw (a closed port, a bug) is reported as INTERNAL,
 * which Ruken also treats as retryable.
 */
export function toHostError(operation: string, capability: Capability, cause: unknown): HostError {
  if (cause instanceof RukenError) {
    if (cause.code === 'DENIED') return new CapabilityDenied({ capability })
    return new HostRequestFailed({ operation, code: cause.code, retryable: cause.retryable })
  }
  return new HostRequestFailed({ operation, code: 'INTERNAL', retryable: true })
}
