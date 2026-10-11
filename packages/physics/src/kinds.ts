// Codes stored in RigidBody*.kind and Collider*.shape (M2.1 spec §3.3). They equal Rapier's own
// RigidBodyType and ShapeType values, in both dimensions.

export const BodyKind: {
  readonly dynamic: 0
  readonly fixed: 1
  readonly kinematicPosition: 2
  readonly kinematicVelocity: 3
} = { dynamic: 0, fixed: 1, kinematicPosition: 2, kinematicVelocity: 3 }
export type BodyKind = (typeof BodyKind)[keyof typeof BodyKind]

export const ShapeKind: { readonly ball: 0; readonly cuboid: 1; readonly capsule: 2 } = {
  ball: 0,
  cuboid: 1,
  capsule: 2,
}
export type ShapeKind = (typeof ShapeKind)[keyof typeof ShapeKind]

/** Options every collider helper takes. The defaults are Rapier's: every group, friction 0.5, no bounce. */
export interface ColliderOptions {
  readonly sensor?: boolean
  readonly groups?: number
  readonly friction?: number
  readonly restitution?: number
}

export function colliderDefaults(opts: ColliderOptions): {
  sensor: boolean
  groups: number
  friction: number
  restitution: number
} {
  return {
    sensor: opts.sensor ?? false,
    groups: opts.groups ?? 0xffffffff,
    friction: opts.friction ?? 0.5,
    restitution: opts.restitution ?? 0,
  }
}
