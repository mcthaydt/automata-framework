import { describe, expect, it } from 'vitest'
import { redact } from './redact.ts'

// The Last Light's redaction (scripts/mcp/tools.ts at 92e6704, G-5) for the providers M3 moves: OpenAI and Meshy.
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
})
