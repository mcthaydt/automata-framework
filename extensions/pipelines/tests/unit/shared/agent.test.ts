import { describe, expect, it } from 'vitest'
import { isAgent } from '#src/shared/agent.ts'

describe('isAgent', () => {
  it('is true when Claude Code or another agent runner marks the environment', () => {
    expect(isAgent({ CLAUDECODE: '1' })).toBe(true)
    expect(isAgent({ AUTOMATA_AGENT: '1' })).toBe(true)
  })

  it('is false for a person', () => {
    expect(isAgent({})).toBe(false)
    expect(isAgent({ CLAUDECODE: '0', AUTOMATA_AGENT: '' })).toBe(false)
  })
})
