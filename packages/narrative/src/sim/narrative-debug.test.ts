import { describe, expect, it } from 'vitest'
import { narrativeDebugSummary } from './narrative-debug'

// DBG-D4: the debug overlay lists a plain summary; narrative builds it from its own state and `debug` imports nothing from here.

describe('narrativeDebugSummary', () => {
  it('lists the graph, the place, the stance and the facts in name order', () => {
    const dialogue = {
      graph: 'guard',
      place: { node: 'ask', line: 2 },
      stance: -1,
      facts: { zeta: 'x', alpha: 3 },
    }
    const summary = narrativeDebugSummary(dialogue)
    expect(summary).toEqual({
      graph: 'guard',
      place: 'ask:2',
      stance: -1,
      facts: { alpha: 3, zeta: 'x' },
    })
    expect(Object.keys((summary as { facts: object }).facts)).toEqual(['alpha', 'zeta'])
  })
  it('says no conversation when none is under way and leaves the state alone', () => {
    const dialogue = { graph: null, place: null, stance: 0, facts: {} }
    expect(narrativeDebugSummary(dialogue)).toEqual({ graph: 'none', place: 'none', stance: 0, facts: {} })
    expect(dialogue).toEqual({ graph: null, place: null, stance: 0, facts: {} })
  })
})
