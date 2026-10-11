import { RukenError } from '@ruken/sdk'
import { describe, expect, it } from 'vitest'
import { CapabilityDenied, HostRequestFailed, toHostError } from './errors'

describe('toHostError', () => {
  it("keeps Ruken's code and retryable flag for a refused or failed request", () => {
    const error = toHostError('saves.flush', 'saves', new RukenError('TIMEOUT', 'no answer'))
    expect(error).toBeInstanceOf(HostRequestFailed)
    expect(error).toMatchObject({
      _tag: 'HostRequestFailed',
      operation: 'saves.flush',
      code: 'TIMEOUT',
      retryable: true,
    })
  })

  it('names the capability when the host answers DENIED', () => {
    const error = toHostError('links.open', 'links', new RukenError('DENIED', 'not granted'))
    expect(error).toBeInstanceOf(CapabilityDenied)
    expect(error).toMatchObject({ _tag: 'CapabilityDenied', capability: 'links' })
  })

  it('treats anything that is not a RukenError as an internal failure that may be retried', () => {
    expect(toHostError('ads.break', 'ads', new Error('port closed'))).toMatchObject({
      _tag: 'HostRequestFailed',
      code: 'INTERNAL',
      retryable: true,
    })
  })
})
