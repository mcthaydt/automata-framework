import { cameraHeadingPlugin } from '@automata/3d/sim'
import { sectorsExtension } from '@automata/sectors'
import { describe, expect, it } from 'vitest'
import { createGameSim } from '#src/app/game-sim.ts'
import { TICK_HZ } from '#src/shared/constants.ts'
import packageJson from '../../../package.json' with { type: 'json' }

// The blank room boots: the sim a screen-less run builds steps a minute-of-a-second and gives the same hash twice.
// The sim has no I/O and no wall clock, so the same seed and content must end in the same state.

const PLUGINS = [...(sectorsExtension.sim ?? []), cameraHeadingPlugin]

async function hashAfter(ticks: number): Promise<string> {
  const sim = await createGameSim({ seed: 1, content: {}, plugins: PLUGINS })
  for (let i = 0; i < ticks; i++) sim.step([])
  return sim.hash()
}

describe('the blank room', () => {
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
