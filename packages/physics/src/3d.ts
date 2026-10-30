// @mcthaydt/automata-physics/3d: 3D physics for the sim (M2.1 spec §3.5). Game code never imports Rapier.
export { BodyKind, type ColliderOptions, ShapeKind } from './kinds'
export { type Physics3DOptions, physics3d } from './physics-3d'
export { Collider3D, RigidBody3D, Transform3D } from './physics-3d.component'
export { CollisionEnded3D, CollisionStarted3D } from './physics-3d.event'
export { body3d, collider3d, transform3d } from './spawn-3d'
