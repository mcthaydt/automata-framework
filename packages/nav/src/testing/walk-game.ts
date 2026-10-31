// A test game for nav: the clinic's map and graph, loaded by a command, with the clinic's boxes behind the game's own
// `Blocked`. Walkers are spawned at setup with sectors' `InSector` and nav's `NavAgent`.
import { InSector, loadSectorMap, resolvedMap, sectorsPlugin } from '@mcthaydt/automata-sectors/sim'
import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type Sim,
  type StepResult,
} from '@mcthaydt/automata-sim'
import { z } from 'zod'
import { createNavPlugin, loadNavGraph, NavAgent } from '../sim/index'
import { clinicBlocked, clinicGraph, clinicMap } from './clinic'

const Load = defineCommand('walk-game.load', z.strictObject({}))
const game = definePlugin({
  name: 'walk-game',
  dependsOn: ['sectors', 'nav'],
  commands: [Load],
  systems: [
    defineSystem('walk-game.load', 'input', (ctx) => {
      if (ctx.commands.of(Load).length === 0) return
      loadSectorMap(ctx, clinicMap())
      loadNavGraph(ctx, clinicGraph())
    }),
  ],
})

export const createWalkGame = (): Promise<Sim> =>
  createSim({
    seed: 2026,
    plugins: [
      sectorsPlugin,
      createNavPlugin({ blocked: (ctx, doors) => clinicBlocked(resolvedMap(ctx), doors) }),
      game,
    ],
  })

/** A walker at (x, z) walking at `speed` m/s; returns its StableId. */
export const spawnWalker = (sim: Sim, x: number, z: number, speed = 1.5): number =>
  sim.spawn([
    [InSector, { x, z }],
    [NavAgent, { speed }],
  ])

export type Order = Pick<Command, 'type' | 'payload'>
export const load = (): Order => ({ type: 'walk-game.load', payload: {} })
export const walkTo = (entity: number, x: number, z: number): Order => ({
  type: 'nav.walk-to',
  payload: { entity, to: { x, z } },
})
export const door = (id: string, open: boolean): Order => ({ type: 'nav.door', payload: { door: id, open } })

export const stepWith = (sim: Sim, orders: readonly Order[] = []): StepResult =>
  sim.step(orders.map((order, seq) => ({ tick: sim.tick, source: 0, seq, ...order })))

export const at = (sim: Sim, sid: number): { x: number; z: number } => {
  const { x, z } = (sim.entity(sid) as NonNullable<ReturnType<Sim['entity']>>).get(InSector)
  return { x, z }
}
