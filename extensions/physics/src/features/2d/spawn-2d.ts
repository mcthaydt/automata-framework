import type { SpawnPart } from '@automata/sim'
import { type BodyKind, type ColliderOptions, colliderDefaults, ShapeKind } from '../../shared/kinds'
import { Collider2D, RigidBody2D, Transform2D } from './physics-2d.component'

// Spawn helpers: component fields default to zero, which is a collider in no group, so
// these give Rapier's defaults instead.

/**
 * The spawn part that places an entity: `x` and `y` in metres and `rotation` in radians, each 0 unless given.
 */
export function transform2d(at: { x?: number; y?: number; rotation?: number } = {}): SpawnPart {
  const { x = 0, y = 0, rotation = 0 } = at
  return [Transform2D, { x, y, rotation }]
}

/**
 * The spawn part that gives an entity a rigid body of a `BodyKind`. Damping and velocities (`vx`, `vy` in
 * m/s, `angvel` in rad/s) are 0 unless given.
 */
export function body2d(
  kind: BodyKind,
  opts: { linearDamping?: number; angularDamping?: number; vx?: number; vy?: number; angvel?: number } = {},
): SpawnPart {
  const { linearDamping = 0, angularDamping = 0, vx = 0, vy = 0, angvel = 0 } = opts
  return [RigidBody2D, { kind, linearDamping, angularDamping, vx, vy, angvel }]
}

/**
 * The spawn parts that give an entity a collider: `ball(radius)`, `cuboid(hx, hy)` with half extents, and
 * `capsule(halfHeight, radius)`. Each takes `ColliderOptions`, whose defaults are Rapier's (every group,
 * friction 0.5, no bounce, not a sensor).
 */
export const collider2d: {
  ball(radius: number, opts?: ColliderOptions): SpawnPart
  cuboid(hx: number, hy: number, opts?: ColliderOptions): SpawnPart
  capsule(halfHeight: number, radius: number, opts?: ColliderOptions): SpawnPart
} = {
  ball: (radius, opts = {}) => [
    Collider2D,
    { shape: ShapeKind.ball, hx: radius, hy: 0, ...colliderDefaults(opts) },
  ],
  cuboid: (hx, hy, opts = {}) => [Collider2D, { shape: ShapeKind.cuboid, hx, hy, ...colliderDefaults(opts) }],
  capsule: (halfHeight, radius, opts = {}) => [
    Collider2D,
    { shape: ShapeKind.capsule, hx: radius, hy: halfHeight, ...colliderDefaults(opts) },
  ],
}
