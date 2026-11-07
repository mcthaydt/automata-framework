// @automata/physics/3d: 3D physics for the sim. Game code never imports Rapier.

export { type Physics3DOptions, physics3d } from '../features/3d/physics-3d'
export { Collider3D, RigidBody3D, Transform3D } from '../features/3d/physics-3d.component'
export { CollisionEnded3D, CollisionStarted3D } from '../features/3d/physics-3d.event'
export { body3d, collider3d, transform3d } from '../features/3d/spawn-3d'
export { BodyKind, type ColliderOptions, ShapeKind } from '../shared/kinds'
