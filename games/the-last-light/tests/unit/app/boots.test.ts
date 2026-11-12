import { content } from 'virtual:automata/content'
import { describe, expect, it } from 'vitest'
import { playOf } from '#src/app/content.ts'
import { createGameSim } from '#src/app/game-sim.ts'
import { TICK_HZ } from '#src/shared/constants.ts'
import packageJson from '../../../package.json' with { type: 'json' }

// The game boots: the sim a screen-less run builds, on the game's own content, steps and gives the same hash twice. The sim
// has no I/O and no wall clock, so the same seed and content must end in the same state.

async function hashAfter(ticks: number): Promise<string> {
  const sim = await createGameSim(playOf(content))
  for (let i = 0; i < ticks; i++) sim.step([])
  return sim.hash()
}

describe('the game', () => {
  it('steps 60 ticks and gives the same hash twice', async () => {
    expect(TICK_HZ).toBe(60)
    const first = await hashAfter(60)
    expect(first).toMatch(/^[0-9a-f]+$/)
    expect(await hashAfter(60)).toBe(first)
  })

  it('is named The Last Light', () => {
    expect(packageJson.automata.title).toBe('The Last Light')
    expect(packageJson.name).toBe('@af-games/the-last-light')
  })
})
