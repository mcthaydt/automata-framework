import { PuzzleSceneResource, PuzzleState } from '@automata/puzzle/sim'
import { createSim, definePlugin } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { puzzleReader } from '#src/shared/sim/puzzle-reader.ts'

// The reader a conversation's conditions use for the game’s facts and items. The sim reads it from its context, and the
// dialogue box from the draw layer’s read-only view, so the two cannot disagree about a choice.

describe('puzzleReader', () => {
  it('reads puzzle’s facts and items, and the game’s own facts first', async () => {
    const sim = await createSim({
      seed: 1,
      plugins: [definePlugin({ name: 'puzzle', resources: [PuzzleState, PuzzleSceneResource] })],
    })
    const state = sim.resource(PuzzleState) as { facts: Record<string, boolean>; items: string[] }
    state.facts.opened = true
    state.items.push('key')
    const reader = puzzleReader(sim, (name) => (name === 'mapped' ? 3 : undefined))
    expect(reader.fact('opened')).toBe(true)
    expect(reader.fact('mapped')).toBe(3)
    expect(reader.fact('nothing')).toBeUndefined()
    expect(reader.has('key')).toBe(true)
    expect(reader.has('lamp')).toBe(false)
    expect(reader.fact('read.desk')).toBe(false)
    sim.dispose()
  })
})
