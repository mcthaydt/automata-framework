import { RukenError } from '@ruken/sdk'
import { describe, expect, it } from 'vitest'
import { HostError, HostHandshakeFailed } from '../contract/errors'
import { toHostError } from './errors-ruken'

describe('toHostError (shared contracts §1.2)', () => {
  it("keeps Ruken's code and retryable flag, and names the operation", () => {
    const cause = new RukenError('TIMEOUT', 'no answer')
    const error = toHostError('saves.flush', cause)
    expect(error).toBeInstanceOf(HostError)
    expect(error).toMatchObject({
      _tag: 'HostError',
      operation: 'saves.flush',
      code: 'TIMEOUT',
      retryable: true,
      cause,
    })
  })

  it('keeps DENIED as DENIED', () => {
    expect(toHostError('display.fullscreen', new RukenError('DENIED', 'no'))).toMatchObject({
      code: 'DENIED',
      retryable: false,
    })
  })

  it("maps a QuotaExceededError from Ruken's save map to QUOTA_EXCEEDED, not retryable", () => {
    const error = toHostError('saves.set', new DOMException('save value exceeds 1 MiB', 'QuotaExceededError'))
    expect(error).toMatchObject({ code: 'QUOTA_EXCEEDED', retryable: false })
  })

  it('treats any other throw as INTERNAL, which Ruken treats as retryable', () => {
    expect(toHostError('saves.flush', new Error('port closed'))).toMatchObject({
      code: 'INTERNAL',
      retryable: true,
    })
  })
})

describe('HostHandshakeFailed', () => {
  it('carries the reason', () => {
    expect(new HostHandshakeFailed({ reason: 'no-welcome' })).toMatchObject({
      _tag: 'HostHandshakeFailed',
      reason: 'no-welcome',
    })
  })
})
