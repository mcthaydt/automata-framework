// A carried light that burns fuel (a hand lamp, a torch): lit or not, fuel in ticks, a toggle, a refill, and the pool it
// gives the senses. It names no item and no number of any game; the game owns which item it is and how much fuel a bottle is.

import { clinicGraph } from '@automata/nav/testing/clinic'
import type { Point } from '@automata/sectors/sim'
import { stateHash, stepWith } from '@automata/sectors/testing'
import { defineCommand, definePlugin, defineSystem, type Sim, type SimContext } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  CarriedLight,
  createCarriedLight,
  LightDry,
  refuel,
  SystemsEnv,
  ToggleLight,
} from '#src/entries/sim.ts'
import type { AgentDef } from '#src/shared/sim/systems.schema.ts'
import { sceneOf } from '#src/testing/toy.ts'
import { agentAt, createWardGame, kinds, load, move, place } from '#src/testing/ward-game.ts'

const NODES = clinicGraph().nodes as Record<string, Point>
const HALL_N = NODES.hallN as Point
const Refuel = defineCommand('test.refuel', z.strictObject({ ticks: z.number(), cap: z.number() }))

let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})

const quiet = sceneOf({
  id: 'quiet',
  modes: ['idle'],
  initial: 'idle',
  speed: { idle: 0 },
  senses: [],
  transitions: [],
})

/** A game whose player carries a lamp with `fuel` ticks; the game clears the lights each step, as a game writes them. */
async function lamp(
  fuel: number,
  radius = 2,
  def = quiet,
  options: Parameters<typeof createWardGame>[1] = {},
) {
  const carried = createCarriedLight()
  const game = await createWardGame(def, options, [], {
    plugins: [
      carried,
      definePlugin({
        name: 'lamp-game',
        dependsOn: ['systems'],
        commands: [Refuel],
        systems: [
          defineSystem('lamp-game.input', 'input', (ctx: SimContext) => {
            const env = ctx.resource(SystemsEnv)
            // The game says what is lit each step: it starts from nothing, and the carried light adds its pool.
            env.lights = []
            for (const { payload } of ctx.commands.of(Refuel))
              refuel(ctx, env.player, payload.ticks, payload.cap)
          }),
        ],
      }),
    ],
  })
  sims.push(game.sim)
  const { sim } = game
  stepWith(sim, [load({ quiet: { x: 3, z: 3 } }), move(0, 4)])
  sim.entity(game.player)?.add(CarriedLight, { lit: false, fuelTicks: fuel, radius })
  const state = () =>
    sim.entity(game.player)?.get(CarriedLight) as { lit: boolean; fuelTicks: number; radius: number }
  return { game, sim, state }
}
const toggle = { type: ToggleLight.id, payload: {} }

describe('a carried light that burns fuel', () => {
  it('is dark until it is lit, and lit it burns one tick of fuel a tick', async () => {
    const { sim, state } = await lamp(10)
    stepWith(sim, [])
    expect(state()).toMatchObject({ lit: false, fuelTicks: 10 })
    stepWith(sim, [toggle])
    expect(state()).toMatchObject({ lit: true, fuelTicks: 9 })
    stepWith(sim, [])
    expect(state().fuelTicks).toBe(8)
  })

  it('goes out when the fuel reaches nothing, with one LightDry', async () => {
    const { sim, state } = await lamp(3)
    const events = [...stepWith(sim, [toggle]).events]
    for (let i = 0; i < 6; i++) events.push(...stepWith(sim, []).events)
    expect(state()).toMatchObject({ lit: false, fuelTicks: 0 })
    expect(kinds(events, LightDry.id)).toEqual([{}])
  })

  it('a toggle puts a lit light out, keeping its fuel', async () => {
    const { sim, state } = await lamp(10)
    stepWith(sim, [toggle])
    stepWith(sim, [toggle])
    expect(state()).toMatchObject({ lit: false, fuelTicks: 9 })
    stepWith(sim, [])
    expect(state().fuelTicks).toBe(9)
  })

  it('a toggle with no fuel does nothing but say the light is dry', async () => {
    const { sim, state } = await lamp(0)
    const events = stepWith(sim, [toggle]).events
    expect(state()).toMatchObject({ lit: false, fuelTicks: 0 })
    expect(kinds(events, LightDry.id)).toEqual([{}])
  })

  it('a refill adds fuel up to the cap, and a dry light can be lit again', async () => {
    const { sim, state } = await lamp(0)
    stepWith(sim, [{ type: 'test.refuel', payload: { ticks: 50, cap: 80 } }])
    expect(state().fuelTicks).toBe(50)
    stepWith(sim, [{ type: 'test.refuel', payload: { ticks: 50, cap: 80 } }])
    expect(state().fuelTicks).toBe(80)
    stepWith(sim, [toggle])
    expect(state().lit).toBe(true)
  })

  it('gives its pool to the senses while it is lit: a disc at the carrier, at its radius', async () => {
    const { sim } = await lamp(10, 2.5)
    stepWith(sim, [])
    expect(sim.resource(SystemsEnv).lights).toEqual([])
    stepWith(sim, [toggle])
    expect(sim.resource(SystemsEnv).lights).toEqual([{ x: 0, z: 4, radius: 2.5 }])
    stepWith(sim, [toggle])
    expect(sim.resource(SystemsEnv).lights).toEqual([])
  })

  it('moves with the carrier', async () => {
    const { sim } = await lamp(100, 2)
    stepWith(sim, [toggle, move(1, 3)])
    expect(sim.resource(SystemsEnv).lights).toEqual([{ x: 1, z: 3, radius: 2 }])
  })

  it('keeps an agent that will not step into light out of the pool', async () => {
    const hunter: AgentDef = {
      id: 'hunter',
      modes: ['hunt'],
      initial: 'hunt',
      speed: { hunt: 2 },
      senses: [],
      transitions: [{ from: 'hunt', to: 'hunt', when: [], priority: 1, do: [{ goTo: 'player' }] }],
    }
    const refuses = (
      w: { env: { lights: { x: number; z: number; radius: number }[] } },
      _id: string,
      to: Point,
    ) => w.env.lights.some((l) => Math.hypot(l.x - to.x, l.z - to.z) <= l.radius)
    const near = (sim: Sim): number => {
      const at = agentAt(sim, 'hunter')
      return Math.hypot(at.x - HALL_N.x, at.z - HALL_N.z)
    }
    const run = async (lit: boolean) => {
      const { sim } = await lamp(1000, 2, sceneOf(hunter), { refuses: refuses as never })
      stepWith(sim, [load({ hunter: NODES.hallS as Point }), move(HALL_N.x, HALL_N.z)])
      place(sim, 'hunter', NODES.hallS as Point)
      if (lit) stepWith(sim, [toggle])
      for (let i = 0; i < 360; i++) stepWith(sim, [])
      return near(sim)
    }
    expect(await run(false)).toBeLessThan(0.5)
    expect(await run(true)).toBeGreaterThan(1.9)
  })

  it('gives the same hash for the same play', async () => {
    const a = await lamp(20)
    const b = await lamp(20)
    for (const { sim } of [a, b]) {
      stepWith(sim, [toggle])
      for (let i = 0; i < 30; i++) stepWith(sim, [])
    }
    expect(stateHash(a.sim)).toBe(stateHash(b.sim))
  })
})
