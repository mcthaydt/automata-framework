import { definePlugin, type PluginDef } from '@mcthaydt/automata-sim'
import { events2D, step2D, syncIn2D, syncOut2D } from './physics.system'
import { Collider2D, RigidBody2D, Transform2D } from './physics-2d.component'
import { CollisionEnded2D, CollisionStarted2D } from './physics-2d.event'
import { PhysicsWorld } from './physics-world'

export interface Physics2DOptions {
  /** m/s², default { x: 0, y: -9.81 }. */
  readonly gravity?: { readonly x: number; readonly y: number }
}

/**
 * The 2D physics plugin (M2.1 spec §3.5). Rapier's wasm loads inside `createSim`, through the dynamic import
 * in rapier-2d.ts, so importing this module costs nothing until a sim uses it.
 */
export function physics2d(options: Physics2DOptions = {}): PluginDef {
  const gravity = options.gravity ?? { x: 0, y: -9.81 }
  return definePlugin({
    name: 'physics-2d',
    // Gravity changes what the plugin simulates, so it is part of the schema hash (spec §10.8).
    config: { gravity },
    components: [Transform2D, RigidBody2D, Collider2D],
    events: [CollisionStarted2D, CollisionEnded2D],
    systems: [syncIn2D, step2D, syncOut2D, events2D],
    state: async ({ dt }) => {
      const { createRapier2D } = await import('./rapier-2d')
      return new PhysicsWorld(await createRapier2D({ gravity, dt }))
    },
  })
}
