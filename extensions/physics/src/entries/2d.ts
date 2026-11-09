// @automata/physics/2d: 2D physics for the sim. Game code never imports Rapier.

export { type Physics2DOptions, physics2d } from '../features/2d/physics-2d'
export { Collider2D, RigidBody2D, Transform2D } from '../features/2d/physics-2d.component'
export { CollisionEnded2D, CollisionStarted2D } from '../features/2d/physics-2d.event'
export { body2d, collider2d, transform2d } from '../features/2d/spawn-2d'
export { BodyKind, type ColliderOptions, ShapeKind } from '../shared/kinds'
