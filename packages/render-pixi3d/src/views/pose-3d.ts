import { lerp, lerpAngle } from '@automataframework/automata'
import type { FieldRecord } from '@automataframework/automata-sim'
import type { Container3D } from '@pixi/3d'

/** Where a 3D view draws: a position in metres and a heading in radians about +y. */
export interface Pose3d {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
}

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

function numberField(record: Readonly<FieldRecord> | undefined, field: string): number {
  const value = record?.[field]
  return typeof value === 'number' ? value : 0
}

/**
 * The pose between the previous tick (`alpha = 0`) and the current one (`alpha = 1`), from a component's `x`, `y`,
 * `z` (metres) and `yaw` (radians), each 0 when missing. `yaw` turns by the shorter arc. With no previous tick
 * (just added, or after a resync) it is the current pose.
 */
export function interpolatePose3d(
  curr: Readonly<FieldRecord>,
  prev: Readonly<FieldRecord> | undefined,
  alpha: number,
): Pose3d {
  const pose = {
    x: numberField(curr, 'x'),
    y: numberField(curr, 'y'),
    z: numberField(curr, 'z'),
    yaw: numberField(curr, 'yaw'),
  }
  if (prev === undefined) return pose
  return {
    x: lerp(numberField(prev, 'x'), pose.x, alpha),
    y: lerp(numberField(prev, 'y'), pose.y, alpha),
    z: lerp(numberField(prev, 'z'), pose.z, alpha),
    yaw: lerpAngle(numberField(prev, 'yaw'), pose.yaw, alpha),
  }
}

/** Places `node` at the interpolated pose of the component a view was registered under. */
export function placeView3d(
  node: Container3D,
  curr: Components,
  prev: Components | undefined,
  alpha: number,
  componentId: string | undefined,
): void {
  const record = componentId === undefined ? undefined : curr[componentId]
  if (record === undefined) return
  const pose = interpolatePose3d(record, componentId === undefined ? undefined : prev?.[componentId], alpha)
  node.position.set(pose.x, pose.y, pose.z)
  node.rotation.set(0, pose.yaw, 0)
}
