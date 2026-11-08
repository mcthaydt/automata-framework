// What `wallsOnly` means in the game, so Schematic's "Boxes and closed doors block its view" is tied to it: a sense
// that leaves it out (or says `true`) is blocked by walls only; `wallsOnly = false` is blocked by boxes too. The desk
// stands between the two spots, and no wall does.
import { resolvedClinic } from '@automata/nav/testing/clinic'
import { type Point, sectorsPlaces } from '@automata/sectors/sim'
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

/** A watcher that stands still and turns to `seen` when it sees the player. */
const oneWatcher = (sight: Sense): AgentDef => ({
  id: 'watcher',
  modes: ['stand', 'seen'],
  initial: 'stand',
  speed: { stand: 0, seen: 0 },
  senses: [sight],
  transitions: [{ from: 'stand', to: 'seen', when: [{ sees: true }], priority: 10, do: [] }],
})

/** Whether a watcher with this sight sees the player across the bench. */
async function seesAcrossTheBench(sight: Sense, to: Point = BEHIND_THE_BENCH): Promise<boolean> {
  const def = oneWatcher(sight)
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

// The games a person makes pass no sight of their own, so systems asks the places, and sectors answers sight with the
// same walking query. Schematic therefore says "Walls and closed doors block its view" and offers no box setting.
describe('sight in a game that uses the places as they are', () => {
  /** A spot inside the guard's range that the clinic's walls hide from the guard. */
  const walledOff = (): Point => {
    const map = resolvedClinic()
    for (let x = -8; x <= 2; x += 0.25)
      for (let z = -2; z <= 8; z += 0.25) {
        const to = { x, z }
        if (Math.hypot(x - GUARD.x, z - GUARD.z) < 4.5 && map.segmentBlocked(GUARD, to, 0)) return to
      }
    throw new Error('the clinic has no wall within five metres of the guard')
  }
  const placesAsTheyAre = {
    blocked: (ctx: Parameters<typeof sectorsPlaces.walk>[0], doors: Record<string, boolean>) =>
      sectorsPlaces.walk(ctx, doors),
    sight: (ctx: Parameters<typeof sectorsPlaces.sight>[0], doors: Record<string, boolean>) =>
      sectorsPlaces.sight(ctx, doors),
  }
  const sees = async (sight: Sense, to: Point): Promise<boolean> => {
    const def = oneWatcher(sight)
    const game = await createWardGame({ ...sceneOf(def), agents: [def] }, placesAsTheyAre)
    sims.push(game.sim)
    stepWith(game.sim, [load({ watcher: GUARD }), move(to.x, to.z)])
    run(game.sim, 0.5)
    return agent(game.sim, 'watcher').mode === 'seen'
  }

  it.each([
    ['leaves wallsOnly out', { range: 5 }],
    ['says wallsOnly is true', { range: 5, wallsOnly: true }],
    ['says wallsOnly is false', { range: 5, wallsOnly: false }],
  ] as const)('a wall hides the player from a sense that %s', async (_, sight) => {
    expect(await sees({ sight }, walledOff())).toBe(false)
  })

  it('the same sense sees the player in the open', async () => {
    expect(await sees({ sight: { range: 5, wallsOnly: false } }, { x: -2.85, z: 2.9 })).toBe(true)
  })
})
