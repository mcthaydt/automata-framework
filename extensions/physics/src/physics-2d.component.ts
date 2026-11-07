import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

// 2D physics components (M2.1 spec §3.3). Every number is f32: Rapier computes in f32, so values read back
// from Rapier are exact and sync-in can compare them with ===.

const transformFields = { x: 'f32', y: 'f32', rotation: 'f32' } as const
/** Position in metres and rotation in radians. Rendered. */
export const Transform2D: ComponentDef<typeof transformFields> = defineComponent(
  'transform-2d',
  transformFields,
)

const bodyFields = {
  kind: 'u32',
  linearDamping: 'f32',
  angularDamping: 'f32',
  vx: 'f32',
  vy: 'f32',
  angvel: 'f32',
} as const
/** A Rapier rigid body: its kind (`BodyKind`), damping, and linear (m/s) and angular (rad/s) velocity. */
export const RigidBody2D: ComponentDef<typeof bodyFields> = defineComponent(
  'physics2d.rigid-body',
  bodyFields,
  {
    render: false,
  },
)

const colliderFields = {
  shape: 'u32',
  hx: 'f32',
  hy: 'f32',
  sensor: 'bool',
  groups: 'u32',
  friction: 'f32',
  restitution: 'f32',
} as const
/**
 * One collider. `shape` is a `ShapeKind`; sizes are halves: ball radius `hx`; cuboid half extents `hx, hy`;
 * capsule radius `hx` and half-height `hy`. `groups` is Rapier's packed membership << 16 | filter.
 */
export const Collider2D: ComponentDef<typeof colliderFields> = defineComponent(
  'physics2d.collider',
  colliderFields,
  { render: false },
)
