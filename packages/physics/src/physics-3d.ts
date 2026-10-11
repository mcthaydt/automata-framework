import { definePlugin, type PluginDef } from '@mcthaydt/automata-sim'
import { events3D, step3D, syncIn3D, syncOut3D } from './physics.system'
import { Collider3D, RigidBody3D, Transform3D } from './physics-3d.component'
import { CollisionEnded3D, CollisionStarted3D } from './physics-3d.event'
import { PhysicsWorld } from './physics-world'

export interface Physics3DOptions {
  /** m/s², default { x: 0, y: -9.81, z: 0 }. */
  readonly gravity?: { readonly x: number; readonly y: number; readonly z: number }
}

/**
 * The 3D physics plugin (M2.1 spec §3.5). Rapier's wasm loads inside `createSim`, through the dynamic import
 * in rapier-3d.ts, so importing this module costs nothing until a sim uses it.
 */
export function physics3d(options: Physics3DOptions = {}): PluginDef {
  const gravity = options.gravity ?? { x: 0, y: -9.81, z: 0 }
  return definePlugin({
    name: 'physics-3d',
    // Gravity changes what the plugin simulates, so it is part of the schema hash (spec §10.8).
    config: { gravity },
    components: [Transform3D, RigidBody3D, Collider3D],
    events: [CollisionStarted3D, CollisionEnded3D],
    systems: [syncIn3D, step3D, syncOut3D, events3D],
    state: async ({ dt }) => {
      const { createRapier3D } = await import('./rapier-3d')
      return new PhysicsWorld(await createRapier3D({ gravity, dt }))
    },
  })
}
