import { describe, expect, it } from 'vitest'
import { redact } from '#src/shared/redact.ts'

// Redaction for the paid providers: OpenAI and Meshy.
// The fake keys are built from parts so no key-shaped string sits in the source.
const OPENAI_SHAPED = `${'sk'}-${'toyFAKEKEY0123456789'}`
const MESHY_SHAPED = `${'msy'}_${'abcdefghij12'}`

describe('redact', () => {
  it("replaces the key variables' values and key-shaped strings", () => {
    const env = { OPENAI_API_KEY: 'openai-secret-value', MESHY_API_KEY: 'meshy-secret-value' }
    const text = `a openai-secret-value b meshy-secret-value c ${OPENAI_SHAPED} d ${MESHY_SHAPED}`
    expect(redact(text, env)).toBe('a [redacted] b [redacted] c [redacted] d [redacted]')
  })

  it('leaves a value shorter than four characters, and other text, alone', () => {
    expect(redact('abc sk-short plain', { OPENAI_API_KEY: 'abc' })).toBe('abc sk-short plain')
    expect(redact('nothing secret here', {})).toBe('nothing secret here')
  })

  it('does not cut a key shape out of the middle of a word', () => {
    expect(redact('desk-lamp-brass and a pagesk-0123456789ab', {})).toBe(
      'desk-lamp-brass and a pagesk-0123456789ab',
    )
    expect(redact('xmsy_abcdefghij12', {})).toBe('xmsy_abcdefghij12')
    expect(redact(`(${OPENAI_SHAPED}) "${MESHY_SHAPED}"`, {})).toBe('([redacted]) "[redacted]"')
  })
})
