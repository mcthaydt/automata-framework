import type { SpawnPart } from '@automata/sim'
import { type BodyKind, type ColliderOptions, colliderDefaults, ShapeKind } from './kinds'
import { Collider3D, RigidBody3D, Transform3D } from './physics-3d.component'

// Spawn helpers (M2.1 spec §3.3): component fields default to zero, which is a degenerate quaternion and a
// collider in no group, so these give the useful defaults instead.

/**
 * The spawn part that places an entity: `x`, `y` and `z` in metres and a rotation quaternion (`qx`, `qy`,
 * `qz`, `qw`). Position is 0 and the rotation is the identity unless given.
 */
export function transform3d(
  at: { x?: number; y?: number; z?: number; qx?: number; qy?: number; qz?: number; qw?: number } = {},
): SpawnPart {
  const { x = 0, y = 0, z = 0, qx = 0, qy = 0, qz = 0, qw = 1 } = at
  return [Transform3D, { x, y, z, qx, qy, qz, qw }]
}

/**
 * The spawn part that gives an entity a rigid body of a `BodyKind`. Damping and velocities (`vx`, `vy`, `vz`
 * in m/s, `wx`, `wy`, `wz` in rad/s) are 0 unless given.
 */
export function body3d(
  kind: BodyKind,
  opts: {
    linearDamping?: number
    angularDamping?: number
    vx?: number
    vy?: number
    vz?: number
    wx?: number
    wy?: number
    wz?: number
  } = {},
): SpawnPart {
  const { linearDamping = 0, angularDamping = 0, vx = 0, vy = 0, vz = 0, wx = 0, wy = 0, wz = 0 } = opts
  return [RigidBody3D, { kind, linearDamping, angularDamping, vx, vy, vz, wx, wy, wz }]
}

/**
 * The spawn parts that give an entity a collider: `ball(radius)`, `cuboid(hx, hy, hz)` with half extents, and
 * `capsule(halfHeight, radius)`. Each takes `ColliderOptions`, whose defaults are Rapier's (every group,
 * friction 0.5, no bounce, not a sensor).
 */
export const collider3d: {
  ball(radius: number, opts?: ColliderOptions): SpawnPart
  cuboid(hx: number, hy: number, hz: number, opts?: ColliderOptions): SpawnPart
  capsule(halfHeight: number, radius: number, opts?: ColliderOptions): SpawnPart
} = {
  ball: (radius, opts = {}) => [
    Collider3D,
    { shape: ShapeKind.ball, hx: radius, hy: 0, hz: 0, ...colliderDefaults(opts) },
  ],
  cuboid: (hx, hy, hz, opts = {}) => [
    Collider3D,
    { shape: ShapeKind.cuboid, hx, hy, hz, ...colliderDefaults(opts) },
  ],
  capsule: (halfHeight, radius, opts = {}) => [
    Collider3D,
    { shape: ShapeKind.capsule, hx: radius, hy: halfHeight, hz: 0, ...colliderDefaults(opts) },
  ],
}
