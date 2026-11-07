// The rig's handles (M3 spec §4.4.2): what a solve is asked to satisfy, after the pose and clip layers have
// merged, and what it reports back. `solve()` (solve.ts) turns them into joint rotations.

import type { Joint } from '../body/rig.ts'

export type Vec3 = readonly [number, number, number]
export type EffectorId = 'footL' | 'footR' | 'handL' | 'handR' | 'pelvis' | 'chest' | 'head'
export type LimbId = 'footL' | 'footR' | 'handL' | 'handR'
export type PoleId = 'kneeL' | 'kneeR' | 'elbowL' | 'elbowR'
/** `root`: figure space, the root joint's frame (+z forward). `chest`: the chest joint's frame. */
export type Space = 'root' | 'chest'

export interface EffectorTarget {
  /** Figure units (1 unit is 1 m on a 1.62 m figure, times height / 1.62), in `space`; omitted leaves the
   * position to the lower layers. The pelvis's is its joint's position in root space; chest and head take none. */
  readonly pos?: Vec3 | undefined
  /** Euler degrees (pitch, yaw, roll), as the source's `euler`. A foot's or hand's is its world turn in
   * `space`; the pelvis's, chest's and head's are local rotations (the chest's shared 0.3/0.7 by spine and
   * chest, the head's 0.4/0.6 by neck and head). */
  readonly rot?: Vec3 | undefined
  /** 'root' by default. */
  readonly space?: Space | undefined
  /** 0 to 1, blending from the base pose; 1 by default. */
  readonly weight?: number | undefined
}
/** The direction the knee or elbow points. */
export interface PoleTarget {
  readonly dir: Vec3
  readonly space?: Space | undefined
}
export interface AimTarget {
  /** A world position, supplied by the sim through the render row. */
  readonly at: Vec3
  readonly part: 'head' | 'chest' | 'handL' | 'handR'
  readonly weight?: number | undefined
}
export interface Reach {
  readonly ok: boolean
  /** Figure units for a position, degrees for a rotation or an aim. */
  readonly error: number
}
export interface SolveReport {
  readonly reached: Readonly<Partial<Record<EffectorId | 'aim', Reach>>>
  /** Joints a limit clamped, in `JOINTS` order. */
  readonly limited: readonly Joint[]
}
/** Everything a solve is asked to satisfy, after the layers have merged. */
export interface Targets {
  readonly effectors: Readonly<Partial<Record<EffectorId, EffectorTarget>>>
  readonly poles: Readonly<Partial<Record<PoleId, PoleTarget>>>
  readonly aim: readonly AimTarget[]
  /** World positions, from the view's state; solved every frame. */
  readonly pins: Readonly<Partial<Record<LimbId, Vec3>>>
}
