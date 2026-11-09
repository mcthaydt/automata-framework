import { defineSystem, type SimContext, type SystemDef } from '@automata/sim'
import type { PhysicsWorld } from './physics-world'

// The four physics systems per dimension. Each reads its sim's own PhysicsWorld from
// `ctx.pluginState`; the logic lives in physics-world.ts so 2D and 3D share it.

const physicsOf = (ctx: SimContext): PhysicsWorld<unknown> => ctx.pluginState as PhysicsWorld<unknown>

export const syncIn3D: SystemDef = defineSystem({
  name: 'physics3d.sync-in',
  phase: 'prePhysics',
  run: (ctx) => physicsOf(ctx).syncIn(ctx),
})
export const step3D: SystemDef = defineSystem({
  name: 'physics3d.step',
  phase: 'physics',
  run: (ctx) => physicsOf(ctx).step(),
})
export const syncOut3D: SystemDef = defineSystem({
  name: 'physics3d.sync-out',
  phase: 'postPhysics',
  run: (ctx) => physicsOf(ctx).syncOut(ctx),
})
export const events3D: SystemDef = defineSystem({
  name: 'physics3d.events',
  phase: 'postPhysics',
  after: ['physics3d.sync-out'],
  run: (ctx) => physicsOf(ctx).emitEvents(ctx),
})

export const syncIn2D: SystemDef = defineSystem({
  name: 'physics2d.sync-in',
  phase: 'prePhysics',
  run: (ctx) => physicsOf(ctx).syncIn(ctx),
})
export const step2D: SystemDef = defineSystem({
  name: 'physics2d.step',
  phase: 'physics',
  run: (ctx) => physicsOf(ctx).step(),
})
export const syncOut2D: SystemDef = defineSystem({
  name: 'physics2d.sync-out',
  phase: 'postPhysics',
  run: (ctx) => physicsOf(ctx).syncOut(ctx),
})
export const events2D: SystemDef = defineSystem({
  name: 'physics2d.events',
  phase: 'postPhysics',
  after: ['physics2d.sync-out'],
  run: (ctx) => physicsOf(ctx).emitEvents(ctx),
})
