import { definePlugin, type PluginDef, type SimContext } from '@automata/sim'
import type { CarriedLightDef } from '@automata/systems/sim'
import { lampGate, lampHold, lampLights, lampRemember } from './lamp.system.ts'
import { LampMemory } from './lamp-memory.resource.ts'

/** The hand lamp's part of the sim over the systems' carried light: who may switch it, the creature's lights, and no burning in a cutscene. */
export const lampPlugin = (def: CarriedLightDef, playing: (ctx: SimContext) => boolean): PluginDef =>
  definePlugin({
    name: 'lamp',
    dependsOn: ['systems', 'carried-light', 'puzzle'],
    defs: [LampMemory, lampGate(def), lampLights, lampRemember, lampHold(playing)],
  })
