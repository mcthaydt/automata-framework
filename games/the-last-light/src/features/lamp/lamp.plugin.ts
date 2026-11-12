import { definePlugin, type PluginDef } from '@automata/sim'
import type { CarriedLightDef } from '@automata/systems/sim'
import { lampGate, lampLights } from './lamp.system.ts'

/** The hand lamp's part of the sim over the systems' carried light: who may switch it (the gate), and nothing else. */
export const lampPlugin = (def: CarriedLightDef): PluginDef =>
  definePlugin({
    name: 'lamp',
    dependsOn: ['systems', 'carried-light', 'puzzle'],
    defs: [lampGate(def), lampLights],
  })
