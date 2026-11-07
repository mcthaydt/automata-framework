// @automata/physics/2d: 2D physics for the sim (M2.1 spec §3.5). Game code never imports Rapier.
export { BodyKind, type ColliderOptions, ShapeKind } from './kinds'
export { type Physics2DOptions, physics2d } from './physics-2d'
export { Collider2D, RigidBody2D, Transform2D } from './physics-2d.component'
export { CollisionEnded2D, CollisionStarted2D } from './physics-2d.event'
export { body2d, collider2d, transform2d } from './spawn-2d'
