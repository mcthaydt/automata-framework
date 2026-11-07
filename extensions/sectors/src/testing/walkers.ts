// A test game for the sectors plugin: commands that load a map, spawn a walker and move it on the plan, so a test or
// the golden drives membership exactly as a game would (the game writes the plan position; sectors reads it).

import { physics3d } from '@automata/physics/3d'
import { createSim, defineCommand, definePlugin, defineSystem, type PluginDef, type Sim } from '@automata/sim'
import { z } from 'zod'
import { loadSectorMapWithColliders, sectorCollidersPlugin } from '../entries/physics'
import { InSector, loadSectorMap, type SectorMap, sectorsPlugin } from '../entries/sim'
import type { Order } from './step-with'

const Load = defineCommand('walkers.load', z.object({ map: z.string() }))
const Spawn = defineCommand('walkers.spawn', z.object({ x: z.number(), z: z.number() }))
const Walk = defineCommand('walkers.walk', z.object({ sid: z.number().int(), x: z.number(), z: z.number() }))

/** With `physics`, maps are loaded with their collider boxes (`physics3d` and the sectors physics plugin registered). */
export interface WalkersOptions {
  readonly physics?: boolean
}

export const walkersPlugin = (
  maps: Readonly<Record<string, SectorMap>>,
  options: WalkersOptions = {},
): PluginDef =>
  definePlugin({
    name: 'walkers',
    dependsOn: options.physics ? ['sectors', 'sectors-physics'] : ['sectors'],
    commands: [Load, Spawn, Walk],
    systems: [
      defineSystem('walkers.drive', 'gameplay', (ctx) => {
        // Walkers first, so their ids do not depend on how many collider boxes a map brings.
        for (const { payload } of ctx.commands.of(Spawn))
          ctx.spawn([InSector, { x: payload.x, z: payload.z }])
        for (const { payload } of ctx.commands.of(Load)) {
          const map = maps[payload.map] as SectorMap
          if (options.physics) loadSectorMapWithColliders(ctx, map)
          else loadSectorMap(ctx, map)
        }
        for (const { payload } of ctx.commands.of(Walk))
          ctx.entity(payload.sid)?.set(InSector, { x: payload.x, z: payload.z })
      }),
    ],
  })

export const createWalkers = (
  maps: Readonly<Record<string, SectorMap>>,
  options: WalkersOptions = {},
  seed = 2026,
): Promise<Sim> =>
  createSim({
    seed,
    plugins: options.physics
      ? [physics3d(), sectorsPlugin, sectorCollidersPlugin, walkersPlugin(maps, options)]
      : [sectorsPlugin, walkersPlugin(maps)],
  })

export const load = (map: string): Order => ({ type: 'walkers.load', payload: { map } })
export const spawn = (x: number, z: number): Order => ({ type: 'walkers.spawn', payload: { x, z } })
export const walk = (sid: number, x: number, z: number): Order => ({
  type: 'walkers.walk',
  payload: { sid, x, z },
})
