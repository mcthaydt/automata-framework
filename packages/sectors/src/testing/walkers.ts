// A test game for the sectors plugin: commands that load a map, spawn a walker and move it on the plan, so a test or
// the golden drives membership exactly as a game would (the game writes the plan position; sectors reads it).
import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type PluginDef,
  type Sim,
  type StepResult,
} from '@mcthaydt/automata-sim'
import { z } from 'zod'
import { InSector, loadSectorMap, type SectorMap, sectorsPlugin } from '../sim/index'

const Load = defineCommand('walkers.load', z.object({ map: z.string() }))
const Spawn = defineCommand('walkers.spawn', z.object({ x: z.number(), z: z.number() }))
const Walk = defineCommand('walkers.walk', z.object({ sid: z.number().int(), x: z.number(), z: z.number() }))

export const walkersPlugin = (maps: Readonly<Record<string, SectorMap>>): PluginDef =>
  definePlugin({
    name: 'walkers',
    dependsOn: ['sectors'],
    commands: [Load, Spawn, Walk],
    systems: [
      defineSystem('walkers.drive', 'gameplay', (ctx) => {
        for (const { payload } of ctx.commands.of(Load)) loadSectorMap(ctx, maps[payload.map] as SectorMap)
        for (const { payload } of ctx.commands.of(Spawn))
          ctx.spawn([InSector, { x: payload.x, z: payload.z }])
        for (const { payload } of ctx.commands.of(Walk))
          ctx.entity(payload.sid)?.set(InSector, { x: payload.x, z: payload.z })
      }),
    ],
  })

export const createWalkers = (maps: Readonly<Record<string, SectorMap>>, seed = 2026): Promise<Sim> =>
  createSim({ seed, plugins: [sectorsPlugin, walkersPlugin(maps)] })

/** A command before it is stamped with the tick it runs on. */
export type Order = Pick<Command, 'type' | 'payload'>

export const load = (map: string): Order => ({ type: 'walkers.load', payload: { map } })
export const spawn = (x: number, z: number): Order => ({ type: 'walkers.spawn', payload: { x, z } })
export const walk = (sid: number, x: number, z: number): Order => ({
  type: 'walkers.walk',
  payload: { sid, x, z },
})

/** Steps `sim` once with `orders`, stamped for its current tick from source 0. */
export const stepWith = (sim: Sim, orders: readonly Order[]): StepResult =>
  sim.step(orders.map((order, seq) => ({ tick: sim.tick, source: 0, seq, ...order })))
