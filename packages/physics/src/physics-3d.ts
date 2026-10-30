import { definePlugin, type PluginDef } from '@mcthaydt/automata-sim'
import { events3D, step3D, syncIn3D, syncOut3D } from './physics.system'
import { Collider3D, RigidBody3D, Transform3D } from './physics-3d.component'
import { CollisionEnded3D, CollisionStarted3D } from './physics-3d.event'
import { PhysicsWorld } from './physics-world'

/**
 * The options of `physics3d`. Gravity is part of the sim's schema hash, so a different gravity is a different
 * sim.
 */
export interface Physics3DOptions {
  /** m/s², default { x: 0, y: -9.81, z: 0 }. */
  readonly gravity?: { readonly x: number; readonly y: number; readonly z: number }
}

/**
 * The 3D physics plugin (M2.1 spec §3.5). Rapier's wasm loads inside `createSim`, through the dynamic import
 * in rapier-3d.ts, so importing this module costs nothing until a sim uses it.
 */
export function physics3d(options: Physics3DOptions = {}): PluginDef {
  const given = options.gravity ?? { x: 0, y: -9.81, z: 0 }
  // A frozen copy: gravity is hashed now, so a caller mutating its own object later must not change what
  // Rapier runs with. `+ 0` turns -0 into 0, which Rapier treats the same, so they hash the same too.
  const gravity = Object.freeze({ x: given.x + 0, y: given.y + 0, z: given.z + 0 })
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
