import { describe, expect, it } from 'vitest'
import { puzzleDebugSummary } from '#src/shared/sim/puzzle-debug.ts'

// DBG-D4: the debug overlay lists a plain summary; puzzle builds it from its own state and `debug` imports nothing from here.

describe('puzzleDebugSummary', () => {
  it('lists the goal, the carried items, the actions seen and the facts in name order', () => {
    const state = {
      facts: { zeta: 1, alpha: true },
      items: ['key', 'lamp'],
      seen: ['open', 'push', 'pull'],
      goal: false,
    }
    const summary = puzzleDebugSummary(state)
    expect(summary).toEqual({
      goal: false,
      items: 'key, lamp',
      seen: 3,
      facts: { alpha: true, zeta: 1 },
    })
    expect(Object.keys((summary as { facts: object }).facts)).toEqual(['alpha', 'zeta'])
  })
  it('says none for no items and leaves the state alone', () => {
    const state = { facts: {}, items: [], seen: [], goal: true }
    expect(puzzleDebugSummary(state)).toEqual({ goal: true, items: 'none', seen: 0, facts: {} })
    expect(state).toEqual({ facts: {}, items: [], seen: [], goal: true })
  })
})
