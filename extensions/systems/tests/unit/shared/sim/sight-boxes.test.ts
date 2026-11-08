// What `wallsOnly` means in the game, so Schematic's "Boxes and closed doors block its view" is tied to it: a sense
// that leaves it out (or says `true`) is blocked by walls only; `wallsOnly = false` is blocked by boxes too. The desk
// stands between the two spots, and no wall does.
import type { Point } from '@automata/sectors/sim'
import { stepWith } from '@automata/sectors/testing'
import type { Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentDef, Sense } from '#src/shared/sim/systems.schema.ts'
import { sceneOf } from '#src/testing/toy.ts'
import { agent, createWardGame, load, move, run } from '#src/testing/ward-game.ts'

let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})

const GUARD: Point = { x: -2.85, z: 2.4 }
const BEHIND_THE_BENCH: Point = { x: -2.85, z: 4.3 }

/** Whether a watcher with this sight sees the player across the bench. */
async function seesAcrossTheBench(sight: Sense, to: Point = BEHIND_THE_BENCH): Promise<boolean> {
  const def: AgentDef = {
    id: 'watcher',
    modes: ['stand', 'seen'],
    initial: 'stand',
    speed: { stand: 0, seen: 0 },
    senses: [sight],
    transitions: [{ from: 'stand', to: 'seen', when: [{ sees: true }], priority: 10, do: [] }],
  }
  const game = await createWardGame({ ...sceneOf(def), agents: [def] })
  sims.push(game.sim)
  stepWith(game.sim, [load({ watcher: GUARD }), move(to.x, to.z)])
  run(game.sim, 0.5)
  return agent(game.sim, 'watcher').mode === 'seen'
}

describe('sight and boxes', () => {
  it('control: nothing between, any sight sees', async () => {
    expect(await seesAcrossTheBench({ sight: { range: 5, wallsOnly: false } }, { x: -2.85, z: 2.9 })).toBe(
      true,
    )
  })
  it('is blocked by walls only when wallsOnly is left out', async () => {
    expect(await seesAcrossTheBench({ sight: { range: 5 } })).toBe(true)
  })
  it('is blocked by walls only when wallsOnly is true', async () => {
    expect(await seesAcrossTheBench({ sight: { range: 5, wallsOnly: true } })).toBe(true)
  })
  it('is blocked by the bench when wallsOnly is false', async () => {
    expect(await seesAcrossTheBench({ sight: { range: 5, wallsOnly: false } })).toBe(false)
  })
})
