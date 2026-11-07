import { RukenError } from '@ruken/sdk'
import { describe, expect, it } from 'vitest'
import { toRefusal } from '#src/features/targets/ruken/errors-ruken.ts'

describe('toRefusal (shared contracts §1.2)', () => {
  it("keeps Ruken's code and retryable flag, and names the operation", () => {
    const cause = new RukenError('TIMEOUT', 'no answer')
    expect(toRefusal('saves.flush', cause)).toEqual({
      operation: 'saves.flush',
      code: 'TIMEOUT',
      retryable: true,
      cause,
    })
  })

  it('keeps DENIED as DENIED', () => {
    expect(toRefusal('display.fullscreen', new RukenError('DENIED', 'no'))).toMatchObject({
      code: 'DENIED',
      retryable: false,
    })
  })

  it("maps a QuotaExceededError from Ruken's save map to QUOTA_EXCEEDED, not retryable", () => {
    const refusal = toRefusal('saves.set', new DOMException('save value exceeds 1 MiB', 'QuotaExceededError'))
    expect(refusal).toMatchObject({ code: 'QUOTA_EXCEEDED', retryable: false })
  })

  it('treats any other throw as INTERNAL, which Ruken treats as retryable', () => {
    expect(toRefusal('saves.flush', new Error('port closed'))).toMatchObject({
      code: 'INTERNAL',
      retryable: true,
    })
  })
})
