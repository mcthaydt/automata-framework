import type { HostResult } from '../shared/host/plain-errors'

/** The value of a host call that must have succeeded; a refusal fails the test with its code. */
export function unwrap<T>(result: HostResult<T>): T {
  if (!result.ok) throw new Error(`the host refused: ${result.reason.code} on ${result.reason.operation}`)
  return result.value
}
