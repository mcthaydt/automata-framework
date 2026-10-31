import { RukenError } from '@ruken/sdk'
import { HostError } from '../contract/errors'

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
