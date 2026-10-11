import type { SpawnPart } from '@mcthaydt/automata-sim'
import { type BodyKind, type ColliderOptions, colliderDefaults, ShapeKind } from './kinds'
import { Collider3D, RigidBody3D, Transform3D } from './physics-3d.component'

// Spawn helpers (M2.1 spec §3.3): component fields default to zero, which is a degenerate quaternion and a
// collider in no group, so these give the useful defaults instead.

export function transform3d(
  at: { x?: number; y?: number; z?: number; qx?: number; qy?: number; qz?: number; qw?: number } = {},
): SpawnPart {
  const { x = 0, y = 0, z = 0, qx = 0, qy = 0, qz = 0, qw = 1 } = at
  return [Transform3D, { x, y, z, qx, qy, qz, qw }]
}

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
