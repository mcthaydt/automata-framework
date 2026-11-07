import { type ComponentDef, defineComponent } from '@automata/sim'

// 3D physics components (M2.1 spec §3.3). Every number is f32: Rapier computes in f32, so values read back
// from Rapier are exact and sync-in can compare them with ===.

const transformFields = { x: 'f32', y: 'f32', z: 'f32', qx: 'f32', qy: 'f32', qz: 'f32', qw: 'f32' } as const
/** Position in metres and rotation as a unit quaternion. Rendered. */
export const Transform3D: ComponentDef<typeof transformFields> = defineComponent(
  'transform-3d',
  transformFields,
)

const bodyFields = {
  kind: 'u32',
  linearDamping: 'f32',
  angularDamping: 'f32',
  vx: 'f32',
  vy: 'f32',
  vz: 'f32',
  wx: 'f32',
  wy: 'f32',
  wz: 'f32',
} as const
/** A Rapier rigid body: its kind (`BodyKind`), damping, and linear (m/s) and angular (rad/s) velocity. */
export const RigidBody3D: ComponentDef<typeof bodyFields> = defineComponent(
  'physics3d.rigid-body',
  bodyFields,
  {
    render: false,
  },
)

const colliderFields = {
  shape: 'u32',
  hx: 'f32',
  hy: 'f32',
  hz: 'f32',
  sensor: 'bool',
  groups: 'u32',
  friction: 'f32',
  restitution: 'f32',
} as const
/**
 * One collider. `shape` is a `ShapeKind`; sizes are halves: ball radius `hx`; cuboid half extents `hx, hy, hz`;
 * capsule radius `hx` and half-height `hy`. `groups` is Rapier's packed membership << 16 | filter.
 */
export const Collider3D: ComponentDef<typeof colliderFields> = defineComponent(
  'physics3d.collider',
  colliderFields,
  { render: false },
)
