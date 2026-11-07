import { definePlugin, type PluginDef } from '@automata/sim'
import { events2D, step2D, syncIn2D, syncOut2D } from '../../shared/physics.system'
import { PhysicsWorld } from '../../shared/physics-world'
import { Collider2D, RigidBody2D, Transform2D } from './physics-2d.component'
import { CollisionEnded2D, CollisionStarted2D } from './physics-2d.event'

/**
 * The options of `physics2d`. Gravity is part of the sim's schema hash, so a different gravity is a different
 * sim.
 */
export interface Physics2DOptions {
  /** m/s², default { x: 0, y: -9.81 }. */
  readonly gravity?: { readonly x: number; readonly y: number }
}

/**
 * The 2D physics plugin. Rapier's wasm loads inside `createSim`, through the dynamic import
 * in rapier-2d.ts, so importing this module costs nothing until a sim uses it.
 */
export function physics2d(options: Physics2DOptions = {}): PluginDef {
  const given = options.gravity ?? { x: 0, y: -9.81 }
  // A frozen copy: gravity is hashed now, so a caller mutating its own object later must not change what
  // Rapier runs with. `+ 0` turns -0 into 0, which Rapier treats the same, so they hash the same too.
  const gravity = Object.freeze({ x: given.x + 0, y: given.y + 0 })
  return definePlugin({
    name: 'physics-2d',
    // Gravity changes what the plugin simulates, so it is part of the schema hash.
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
