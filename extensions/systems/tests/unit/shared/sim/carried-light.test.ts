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
  type CarriedLightDef,
  carriedLightDefOf,
  createCarriedLight,
  DEFAULT_CARRIED_LIGHT,
  fuelTicksOf,
  LightDry,
  refill,
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
const Refill = defineCommand('test.refill', z.strictObject({}))

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
  light?: CarriedLightDef,
) {
  const carried = createCarriedLight(light === undefined ? {} : { def: light })
  const game = await createWardGame(def, options, [], {
    plugins: [
      carried,
      definePlugin({
        name: 'lamp-game',
        dependsOn: ['systems'],
        commands: [Refuel, Refill],
        systems: [
          defineSystem('lamp-game.input', 'input', (ctx: SimContext) => {
            const env = ctx.resource(SystemsEnv)
            // The game says what is lit each step: it starts from nothing, and the carried light adds its pool.
            env.lights = []
            for (const { payload } of ctx.commands.of(Refuel))
              refuel(ctx, env.player, payload.ticks, payload.cap)
            if (light !== undefined && ctx.commands.of(Refill).length > 0) refill(ctx, env.player, light)
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

describe('a carried light with its numbers from a file', () => {
  const file = (over: Partial<CarriedLightDef> = {}): CarriedLightDef => carriedLightDefOf({ ...over })
  const refillCommand = { type: 'test.refill', payload: {} }

  it('has the old game’s numbers when the file says none: 2.2 m, a refill of 40 s, twice that held, burning in real time', () => {
    expect(carriedLightDefOf(undefined)).toEqual({ radius: 2.2, start: 0, fill: 40, cap: 80, burn: 1 })
    expect(DEFAULT_CARRIED_LIGHT).toEqual(carriedLightDefOf({}))
  })

  it('counts its fuel in ticks at the sim’s rate', () => {
    expect(fuelTicksOf(40, 60)).toBe(2400)
    expect(fuelTicksOf(0.5, 60)).toBe(30)
    expect(fuelTicksOf(40, 30)).toBe(1200)
  })

  it('its pool is the file’s radius, whatever the component carries', async () => {
    const { sim } = await lamp(10, 99, quiet, {}, file({ radius: 3.1 }))
    stepWith(sim, [toggle])
    expect(sim.resource(SystemsEnv).lights).toEqual([{ x: 0, z: 4, radius: 3.1 }])
  })

  it('burns the file’s rate: a burn of 2 costs two ticks of fuel a lit tick, and runs dry in half the time', async () => {
    const { sim, state } = await lamp(10, 2, quiet, {}, file({ burn: 2 }))
    stepWith(sim, [toggle])
    expect(state()).toMatchObject({ lit: true, fuelTicks: 8 })
    stepWith(sim, [])
    expect(state().fuelTicks).toBe(6)
    const events = []
    for (let i = 0; i < 4; i++) events.push(...stepWith(sim, []).events)
    expect(state()).toMatchObject({ lit: false, fuelTicks: 0 })
    expect(kinds(events, LightDry.id)).toEqual([{}])
  })

  it('a refill adds the file’s fill and stops at its cap, in seconds of fuel', async () => {
    const small = file({ fill: 1, cap: 1.5 })
    const { sim, state } = await lamp(0, 2, quiet, {}, small)
    stepWith(sim, [refillCommand])
    expect(state().fuelTicks).toBe(60)
    stepWith(sim, [refillCommand])
    expect(state().fuelTicks).toBe(90)
  })

  it('with a file the light burns as it did without one, at the default rate', async () => {
    const a = await lamp(20, 2, quiet, {}, file())
    const b = await lamp(20, 2)
    for (const { sim } of [a, b]) {
      stepWith(sim, [toggle])
      for (let i = 0; i < 5; i++) stepWith(sim, [])
    }
    expect(a.state().fuelTicks).toBe(b.state().fuelTicks)
  })

  it('gives the same hash for the same file and the same play', async () => {
    const a = await lamp(20, 2, quiet, {}, file({ burn: 3 }))
    const b = await lamp(20, 2, quiet, {}, file({ burn: 3 }))
    for (const { sim } of [a, b]) {
      stepWith(sim, [toggle])
      for (let i = 0; i < 4; i++) stepWith(sim, [])
    }
    expect(stateHash(a.sim)).toBe(stateHash(b.sim))
  })

  it('a bad number is refused when the plugin is made, in words', () => {
    expect(() => createCarriedLight({ def: { ...DEFAULT_CARRIED_LIGHT, burn: 0.5 } })).toThrow(
      /carried light: burn must be a whole number of 1 or more, not 0.5/,
    )
  })
})
